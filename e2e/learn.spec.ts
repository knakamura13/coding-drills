import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { loadDecks } from '../src/lib/content/loadDecks.ts';
import {
	isChoiceQuestion,
	isTapCellQuestion,
	type ChoiceQuestion,
	type Question,
	type TapCellQuestion
} from '../src/lib/content/schema.ts';
import { cellLabel } from '../src/lib/domain/tap.ts';
import { plainText } from '../src/lib/markdown/render.ts';
import { PREFERENCES_KEY } from '../src/lib/preferences/preferences.ts';

// The new lesson screen on /learn/<deck>: multiple-choice and tap-the-cell questions on the
// FigCraft design. Drag-pointers and step-trace questions are left out until they land.

const decks = loadDecks('content/decks');
const runs = (question: Question) => isChoiceQuestion(question) || isTapCellQuestion(question);
const deck = decks.find((candidate) => candidate.id === 'boundary-search')!;
const questions = deck.questions.filter(isChoiceQuestion);
const shown = deck.questions.filter(runs);
const URL = `/learn/${deck.id}`;
const cellsDeck = decks.find((candidate) => candidate.id === 'tap-the-cell')!;
const cellQuestions = cellsDeck.questions.filter(isTapCellQuestion);

const tiles = (page: Page) => page.getByRole('group', { name: /./ }).locator('label, button');
const cell = (page: Page, index: number) => page.getByRole('radio', { name: new RegExp(`^Index ${index},`) });
const labelledCells = (page: Page) => page.locator('[aria-label^="Index "]');
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
	await tiles(page).first().waitFor();
	const answers = (await tiles(page).allInnerTexts()).map((label) => label.trim()).sort();
	const match = pool.find(
		(question) =>
			JSON.stringify(question.options.map((option) => plainText(option.text, 1000)).sort()) === JSON.stringify(answers)
	);
	if (!match) throw new Error(`no question has these answers: ${answers.join(' | ')}`);
	return match;
}

/** The values a tap question's cells show, as their accessible names spell them. */
const cellValues = (question: TapCellQuestion) => [
	...question.sequence.cells.map((value) => (value === '' ? 'empty' : value)),
	...(question.sequence.pastEnd ? ['past the end'] : [])
];

/** Which question is on screen, of either format: cells by their values, tiles by their answers. */
async function onScreen(page: Page, pool: Question[] = shown): Promise<Question> {
	await page.locator('fieldset').first().waitFor();
	const names = await labelledCells(page).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')!));
	if (names.length === 0) return current(page, pool.filter(isChoiceQuestion));
	const values = names.map((name) => name.match(/^Index \d+, (.*?)(, marked .*)?$/)![1]);
	const match = pool.filter(isTapCellQuestion).find((question) => JSON.stringify(cellValues(question)) === JSON.stringify(values));
	if (!match) throw new Error(`no question has these cells: ${values.join(' | ')}`);
	return match;
}

/** A multiple-choice question first: the lesson order is random, so reload until one leads. */
async function firstChoice(page: Page): Promise<ChoiceQuestion> {
	for (let attempt = 0; attempt < 30; attempt++) {
		await page.locator('fieldset').first().waitFor();
		if ((await labelledCells(page).count()) === 0) return current(page);
		await page.goto(URL);
	}
	throw new Error('a multiple-choice question never came first');
}

/** Answers right with Check, then Continues. A right answer never opens a follow-up. */
async function answerRight(page: Page, question: Question) {
	if (isTapCellQuestion(question)) await cell(page, question.correct).check();
	else if (isChoiceQuestion(question)) await pick(page, optionLabel(question, question.correct));
	await primary(page).click();
	await primary(page).click();
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
	await expect(progress).toHaveAttribute('aria-valuemax', String(shown.length));
	await expect(primary(page)).toHaveText('Check');
	await expect(primary(page)).toBeDisabled();
	expect(await page.evaluate(() => document.documentElement.dataset.branch)).toBe('sequences-and-search');
	expect(await violations(page)).toEqual([]);
});

test('a right answer: the tile shows it, Continue moves on and focus goes to the next heading', async ({ page }) => {
	const question = await firstChoice(page);
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
	const question = await firstChoice(page);
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
	await answerRight(page, await onScreen(page));
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
	for (let index = 0; index < shown.length; index++) await answerRight(page, await onScreen(page));
	await expect(page.getByRole('heading', { name: `${shown.length} of ${shown.length} right the first time` })).toBeVisible();
	await page.getByRole('button', { name: 'Retry' }).click();
	await expect(page.getByRole('progressbar', { name: 'Lesson progress' })).toHaveAttribute('aria-valuenow', '0');
});

test('desktop keeps the lesson in a 640px column', async ({ page, isMobile }) => {
	test.skip(isMobile, 'desktop layout only');
	const box = await page.locator('main').boundingBox();
	expect(box!.width).toBeLessThanOrEqual(672);
});

test('a deck with no questions the new screen runs yet is not found', async ({ page }) => {
	const none = decks.find((candidate) => !candidate.questions.some(runs));
	test.skip(!none, 'every deck has a question the new screen runs');
	const response = await page.goto(`/learn/${none!.id}`);
	await expect(page.getByText('This deck has no questions the new lesson screen runs yet')).toBeVisible();
	expect(response?.status() ?? 200).toBeLessThan(500);
});

test('a prompt with a code block meets contrast and does not wrap code lines', async ({ page }) => {
	const withCode = questions.filter((question) => question.prompt.includes('```'));
	test.skip(withCode.length === 0, 'no prompt in this deck has a code block');
	for (let index = 0; index < shown.length; index++) {
		const question = await onScreen(page);
		if (isChoiceQuestion(question) && question.prompt.includes('```')) {
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
		await answerRight(page, question);
	}
	throw new Error('the code block question never came up');
});

test('a deck without headings still gives each question a heading to land on', async ({ page }) => {
	const headingless = decks.find(
		(candidate) =>
			!candidate.heading &&
			candidate.questions.some(isChoiceQuestion) &&
			candidate.questions.filter(runs).every((question) => !question.heading)
	);
	test.skip(!headingless, 'every deck has a heading');
	const own = headingless!.questions.filter(runs);
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
		const question = await firstChoice(page);
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
	const heaps = decks.find((candidate) => candidate.id === 'bounded-heaps-checkpoint')!;
	const pool = heaps.questions.filter(runs);
	await page.goto(`/learn/${heaps.id}`);
	// Right answers skip their follow-ups, so answer right until the question with the long pick.
	for (let step = 0; step < pool.length; step++) {
		const question = await onScreen(page, pool);
		const long = isChoiceQuestion(question) && question.options.find((option) => option.id === 'guard-on-heap');
		if (!long) {
			await answerRight(page, question);
			continue;
		}
		await pick(page, plainText(long.text, 1000));
		await primary(page).click();
		await primary(page).click();
		break;
	}
	const summary = page.locator('details summary');
	await expect(summary).toContainText('You picked');
	const fits = await summary.evaluate((node) => node.scrollWidth <= node.clientWidth);
	expect(fits).toBe(true);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test.describe('tap the cell', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(`/learn/${cellsDeck.id}`);
	});

	test('a tap picks a cell, Check answers, and the right cell takes the result', async ({ page }) => {
		const question = (await onScreen(page, cellQuestions)) as TapCellQuestion;
		await expect(page.getByRole('group', { name: new RegExp(`^(Array|String) ${question.sequence.name}, \\d+ cells$`) })).toBeVisible();
		await expect(page.getByRole('main').getByLabel('Code')).toBeVisible();
		await expect(primary(page)).toBeDisabled();
		await cell(page, question.correct).check();
		await expect(primary(page)).toBeEnabled();
		await primary(page).click();
		await expect(panel(page)).toHaveAccessibleName('Correct');
		await expect(primary(page)).toBeFocused();
		await expect(cell(page, question.correct)).toHaveAccessibleName(/, the right cell$/);
		await expect(page.getByRole('status')).toHaveText(`Correct. ${plainText(question.explanation, 1000)}`);
		expect(await violations(page)).toEqual([]);
	});

	test('a wrong tap: the tap in rose, the right cell marked, the miss explained, no follow-up', async ({ page }) => {
		const question = (await onScreen(page, cellQuestions)) as TapCellQuestion;
		const miss = question.misses[0];
		await cell(page, miss.index).check();
		await primary(page).click();
		await expect(panel(page)).toHaveAccessibleName('Not quite');
		await expect(panel(page)).toContainText(plainText(miss.explanation, 1000));
		await expect(cell(page, miss.index)).toHaveAccessibleName(/, your tap, not right$/);
		await expect(cell(page, question.correct)).toHaveAccessibleName(/, the right cell$/);
		await expect(page.getByRole('status')).toHaveText(
			`Not quite. The right answer: ${plainText(cellLabel(question, question.correct), 300)}. ${plainText(miss.explanation, 1000)}`
		);
		expect(await violations(page)).toEqual([]);
		await primary(page).click();
		await expect(page.getByRole('progressbar', { name: 'Lesson progress' })).toHaveAttribute('aria-valuenow', '1');
		await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
	});

	test('markers sit under their cells, and the slot past the end is dashed with its own index', async ({ page }) => {
		const seen = new Set<string>();
		for (let index = 0; index < cellQuestions.length; index++) {
			const question = (await onScreen(page, cellQuestions)) as TapCellQuestion;
			const strip = page.getByRole('group', { name: /cells$/ });
			for (const marker of question.markers ?? []) {
				await expect(cell(page, marker.at)).toHaveAccessibleName(new RegExp(`marked .*\\b${marker.name}\\b`));
				await expect(strip.getByText(marker.name, { exact: true })).toBeVisible();
				seen.add('markers');
			}
			if (question.sequence.pastEnd) {
				const slot = cell(page, question.sequence.cells.length);
				await expect(slot).toHaveAccessibleName(`Index ${question.sequence.cells.length}, past the end`);
				expect(await slot.evaluate((input) => getComputedStyle(input.parentElement!).borderStyle)).toBe('dashed');
				seen.add('past end');
			}
			await answerRight(page, question);
		}
		expect([...seen].sort()).toEqual(['markers', 'past end']);
	});

	test('a strip wider than a phone scrolls inside itself, not the page', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		const wide = decks.find((candidate) => candidate.id === 'dp-storage-review')!;
		const pool = wide.questions.filter(runs);
		await page.goto(`/learn/${wide.id}`);
		for (let step = 0; step < pool.length; step++) {
			const question = await onScreen(page, pool);
			if (question.id === 'storage-review-tap-oldest') break;
			await answerRight(page, question);
		}
		const strip = page.getByRole('group', { name: 'Array ways, 10 cells' });
		const scroller = strip.locator('..');
		expect(await scroller.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
		await cell(page, 9).check();
		const box = (await cell(page, 9).locator('..').boundingBox())!;
		expect(box.x + box.width).toBeLessThanOrEqual(390);
	});
});

test.describe('with Immediate feedback on', () => {
	test.beforeEach(async ({ page }) => {
		await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ immediateFeedback: true })), PREFERENCES_KEY);
	});

	test('cells are buttons: arrow keys move focus without answering, and Enter answers', async ({ page }) => {
		await page.goto(`/learn/${cellsDeck.id}`);
		const question = (await onScreen(page, cellQuestions)) as TapCellQuestion;
		await expect(page.getByRole('radio')).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Check' })).toHaveCount(0);
		await page.getByRole('button', { name: /^Index 0,/ }).focus();
		await page.keyboard.press('ArrowRight');
		await expect(page.getByRole('button', { name: /^Index 1,/ })).toBeFocused();
		await page.keyboard.press('End');
		await expect(labelledCells(page).last()).toBeFocused();
		await expect(panel(page)).toHaveCount(0);
		await page.getByRole('button', { name: new RegExp(`^Index ${question.correct},`) }).focus();
		await page.keyboard.press('Enter');
		await expect(panel(page)).toHaveAccessibleName('Correct');
		expect(await violations(page)).toEqual([]);
	});

	test('answer tiles are buttons too, so an arrow key never picks an answer', async ({ page }) => {
		await page.goto(URL);
		await firstChoice(page);
		await expect(page.getByRole('radio')).toHaveCount(0);
		const answers = page.getByRole('group', { name: /./ }).getByRole('button');
		await answers.first().focus();
		await page.keyboard.press('ArrowDown');
		await expect(answers.nth(1)).toBeFocused();
		await expect(panel(page)).toHaveCount(0);
		await page.keyboard.press('Enter');
		await expect(panel(page)).toHaveAccessibleName(/^(Correct|Not quite)$/);
		expect(await violations(page)).toEqual([]);
	});
});
