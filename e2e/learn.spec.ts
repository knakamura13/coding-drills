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
const primary = (page: Page) => page.getByRole('contentinfo').getByRole('button');

/** Which deck question is on screen, from its answer labels. */
async function current(page: Page): Promise<ChoiceQuestion> {
	await page.getByRole('radio').first().waitFor();
	const shown = (await tiles(page).allInnerTexts()).map((label) => label.trim()).sort();
	const match = questions.find(
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
	expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('a right answer: the tile shows it, Continue moves on and focus goes to the next heading', async ({ page }) => {
	const question = await current(page);
	await pick(page, optionLabel(question, question.correct));
	await expect(primary(page)).toBeEnabled();
	await primary(page).click();
	await expect(primary(page)).toHaveText('Continue');
	await expect(page.getByText(', the right answer')).toHaveCount(1);
	await expect(page.getByRole('radio').first()).toBeDisabled();
	expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
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
	await primary(page).click();
	await expect(page.getByText('Follow-up', { exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
	await expect(primary(page)).toHaveText('Check');
	expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
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
	expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
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
			expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
			return;
		}
		await pick(page, optionLabel(question, question.correct));
		await primary(page).click();
		await primary(page).click();
	}
	throw new Error('the code block question never came up');
});
