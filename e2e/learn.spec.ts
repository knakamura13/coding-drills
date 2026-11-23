import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { loadDecks } from '../src/lib/content/loadDecks.ts';
import { isChoiceQuestion, type ChoiceQuestion } from '../src/lib/content/schema.ts';
import { plainText } from '../src/lib/markdown/render.ts';

// The new lesson screen on /learn/<deck>: multiple-choice questions on the FigCraft design.

const deck = loadDecks('content/decks').find((candidate) => candidate.id === 'boundary-search')!;
const questions = deck.questions.filter(isChoiceQuestion);
const URL = `/learn/${deck.id}`;

const tiles = (page: Page) => page.getByRole('group', { name: /./ }).locator('label');
// Check in the footer, or Continue in the feedback panel that replaces it.
const primary = (page: Page) => page.getByRole('button', { name: /^(Check|Continue)$/ });
const panel = (page: Page) => page.getByRole('region', { name: /^(Correct|Not quite)$/ });

// The new UI keeps its fades under reduced motion, so axe waits for them: mid-fade, text shows
// through a half-transparent sheet or panel and fails contrast it passes once settled.
async function violations(page: Page) {
	await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)));
	return (await new AxeBuilder({ page }).analyze()).violations;
}

/** Which deck question is on screen, from its answer labels. */
async function current(page: Page, pool: ChoiceQuestion[] = questions): Promise<ChoiceQuestion> {
	await page.getByRole('radio').first().waitFor();
	const shown = (await tiles(page).allInnerTexts()).map((label) => label.trim()).sort();
	const match = pool.find(
		(question) =>
			JSON.stringify(question.options.map((option) => plainText(option.text, 1000)).sort()) === JSON.stringify(shown)
	);
	if (!match) throw new Error(`no question has these answers: ${shown.join(' | ')}`);
	return match;
}

const optionLabel = (question: ChoiceQuestion, id: string) => plainText(question.options.find((o) => o.id === id)!.text, 1000);

async function pick(page: Page, label: string) {
	await page.getByRole('radio', { name: label, exact: true }).check();
}

test.beforeEach(async ({ page }) => {
	await page.goto(URL);
	await expect(page.getByRole('radio').first()).toBeVisible();
});

test('opens on the new screen: deck title, no counter, Check waits for a pick', async ({ page }) => {
	await expect(page.getByRole('banner').getByText(deck.title)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Menu' })).toHaveCount(0);
	const progress = page.getByRole('progressbar', { name: 'Lesson progress' });
	await expect(progress).toHaveAttribute('aria-valuenow', '0');
	await expect(progress).toHaveAttribute('aria-valuemax', String(questions.length));
	await expect(primary(page)).toHaveText('Check');
	await expect(primary(page)).toBeDisabled();
	expect(await page.evaluate(() => document.documentElement.dataset.branch)).toBe('sequences-and-search');
	expect(await violations(page)).toEqual([]);
});

test('a right answer: the tile shows it, Continue moves on and focus goes to the next heading', async ({ page }) => {
	const question = await current(page);
	await pick(page, optionLabel(question, question.correct));
	await expect(primary(page)).toBeEnabled();
	await primary(page).click();
	await expect(panel(page)).toHaveAccessibleName('Correct');
	await expect(primary(page)).toHaveText('Continue');
	await expect(primary(page)).toBeFocused();
	await expect(page.getByText(', the right answer')).toHaveCount(1);
	const right = question.options.find((option) => option.id === question.correct)!;
	await expect(page.getByRole('status')).toHaveText(`Correct. ${plainText(right.explanation, 1000)}`);
	await expect(page.getByRole('radio').first()).toBeDisabled();
	expect(await violations(page)).toEqual([]);
	await primary(page).click();
	await expect(page.getByRole('progressbar', { name: 'Lesson progress' })).toHaveAttribute('aria-valuenow', '1');
	await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
});

test('a wrong answer: rose pick, right answer marked, then its follow-up', async ({ page }) => {
	const question = await current(page);
	const wrong = question.options.find((option) => option.id !== question.correct)!;
	await pick(page, plainText(wrong.text, 1000));
	await primary(page).click();
	await expect(page.getByText(', your answer, not right')).toHaveCount(1);
	await expect(page.getByText(', the right answer')).toHaveCount(1);
	await expect(panel(page)).toHaveAccessibleName('Not quite');
	// The panel explains the pick itself and does not repeat the right answer; speech names it.
	await expect(panel(page)).toContainText(plainText(wrong.explanation, 1000));
	await expect(page.getByRole('status')).toHaveText(
		`Not quite. The right answer: ${optionLabel(question, question.correct)}. ${plainText(wrong.explanation, 1000)}`
	);
	expect(await violations(page)).toEqual([]);
	await primary(page).click();
	await expect(page.getByText('Follow-up', { exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
	// The folded recap names the question and the pick, and opens to show the original prompt.
	const recap = page.locator('details');
	await expect(recap).toContainText(`You picked ${plainText(wrong.text, 1000)}`);
	await expect(recap).not.toHaveAttribute('open');
	await recap.locator('summary').focus();
	await page.keyboard.press('Enter');
	await expect(recap).toHaveAttribute('open', '');
	await expect(primary(page)).toHaveText('Check');
	expect(await violations(page)).toEqual([]);
});

test('answers are a radio group: arrow keys move the pick', async ({ page, browserName }) => {
	test.skip(browserName === 'webkit', 'WebKit does not move radio focus with Tab by default');
	await page.getByRole('radio').first().focus();
	await page.keyboard.press('ArrowDown');
	await expect(page.getByRole('radio').nth(1)).toBeChecked();
	await expect(primary(page)).toBeEnabled();
});

test('quitting before any answer leaves at once; after one it asks first', async ({ page }) => {
	await page.getByRole('button', { name: 'Quit lesson' }).click();
	await expect(page).toHaveURL(/\/$/);

	await page.goto(URL);
	const question = await current(page);
	await pick(page, optionLabel(question, question.correct));
	await primary(page).click();
	await primary(page).click();
	await page.getByRole('button', { name: 'Quit lesson' }).click();
	const sheet = page.getByRole('dialog', { name: 'Quit this lesson?' });
	await expect(sheet).toBeVisible();
	expect(await violations(page)).toEqual([]);
	await sheet.getByRole('button', { name: 'Continue' }).click();
	await expect(sheet).toBeHidden();
	await page.getByRole('button', { name: 'Quit lesson' }).click();
	await sheet.getByRole('button', { name: 'Quit' }).click();
	await expect(page).toHaveURL(/\/$/);
});

test('every question answered right reaches the end, with Done and Retry', async ({ page }) => {
	for (let index = 0; index < questions.length; index++) {
		const question = await current(page);
		await pick(page, optionLabel(question, question.correct));
		await primary(page).click();
		await primary(page).click();
	}
	await expect(page.getByRole('heading', { name: `${questions.length} of ${questions.length} right the first time` })).toBeVisible();
	await page.getByRole('button', { name: 'Retry' }).click();
	await expect(page.getByRole('progressbar', { name: 'Lesson progress' })).toHaveAttribute('aria-valuenow', '0');
});

test('desktop keeps the lesson in a 640px column', async ({ page, isMobile }) => {
	test.skip(isMobile, 'desktop layout only');
	const box = await page.locator('main').boundingBox();
	expect(box!.width).toBeLessThanOrEqual(672);
});

test('a deck with no multiple-choice questions yet is not found', async ({ page }) => {
	const none = loadDecks('content/decks').find((candidate) => !candidate.questions.some(isChoiceQuestion));
	test.skip(!none, 'every deck has a multiple-choice question');
	const response = await page.goto(`/learn/${none!.id}`);
	await expect(page.getByText('This deck has no multiple-choice questions yet')).toBeVisible();
	expect(response?.status() ?? 200).toBeLessThan(500);
});

test('a prompt with a code block meets contrast and does not wrap code lines', async ({ page }) => {
	const withCode = questions.filter((question) => question.prompt.includes('```'));
	test.skip(withCode.length === 0, 'no prompt in this deck has a code block');
	for (let index = 0; index < questions.length; index++) {
		const question = await current(page);
		if (question.prompt.includes('```')) {
			const code = page.getByRole('main').getByLabel('Code');
			await expect(code).toBeVisible();
			// Indentation survives: some line of the snippet starts with spaces on screen.
			const indents = await code
				.locator('.line .text')
				.evaluateAll((lines) => lines.map((line) => (line.textContent ?? '').match(/^ */)![0].length));
			expect(Math.max(...indents)).toBeGreaterThan(0);
			const shown = await code
				.locator('.line .text')
				.first()
				.evaluate((node) => getComputedStyle(node.parentElement!.parentElement!).whiteSpace);
			expect(shown).toBe('pre');
			expect(await violations(page)).toEqual([]);
			return;
		}
		await pick(page, optionLabel(question, question.correct));
		await primary(page).click();
		await primary(page).click();
	}
	throw new Error('the code block question never came up');
});

test('a deck without headings still gives each question a heading to land on', async ({ page }) => {
	const headingless = loadDecks('content/decks').find(
		(candidate) =>
			!candidate.heading &&
			candidate.questions.some(isChoiceQuestion) &&
			candidate.questions.filter(isChoiceQuestion).every((question) => !question.heading)
	);
	test.skip(!headingless, 'every deck has a heading');
	const own = headingless!.questions.filter(isChoiceQuestion);
	await page.goto(`/learn/${headingless!.id}`);
	const h1 = page.getByRole('heading', { level: 1 });
	await expect(h1).toHaveText(`Question 1 of ${own.length}`);
	await page.getByRole('radio').first().check();
	await primary(page).click();
	await primary(page).click();
	await expect(h1).toBeFocused();
	expect(await violations(page)).toEqual([]);
});

test('the feedback panel rises in 150 ms, and only fades with reduced motion', async ({ page }) => {
	for (const motion of ['no-preference', 'reduce'] as const) {
		await page.emulateMedia({ reducedMotion: motion });
		await page.goto(URL);
		const question = await current(page);
		await pick(page, optionLabel(question, question.correct));
		await primary(page).click();
		const style = await panel(page).evaluate((node) => {
			const css = getComputedStyle(node);
			return { name: css.animationName, duration: css.animationDuration, shift: css.getPropertyValue('--shift').trim() };
		});
		// Svelte scopes keyframe names, so the name ends in "rise".
		expect(style.name).toMatch(/rise$/);
		expect({ duration: style.duration, shift: style.shift }).toEqual({ duration: '0.15s', shift: motion === 'reduce' ? '0' : '1' });
	}
});

test('a long code pick wraps in the recap instead of widening the card', async ({ page }) => {
	const heaps = loadDecks('content/decks').find((candidate) => candidate.id === 'bounded-heaps-checkpoint')!;
	const pool = heaps.questions.filter(isChoiceQuestion);
	await page.goto(`/learn/${heaps.id}`);
	// Right answers skip their follow-ups, so answer right until the question with the long pick.
	for (let step = 0; step < pool.length; step++) {
		const question = await current(page, pool);
		const long = question.options.find((option) => option.id === 'guard-on-heap');
		await pick(page, optionLabel(question, long ? long.id : question.correct));
		await primary(page).click();
		await primary(page).click();
		if (long) break;
	}
	const summary = page.locator('details summary');
	await expect(summary).toContainText('You picked');
	const fits = await summary.evaluate((node) => node.scrollWidth <= node.clientWidth);
	expect(fits).toBe(true);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
