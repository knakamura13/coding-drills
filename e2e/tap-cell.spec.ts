import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { loadDecks } from '../src/lib/content/loadDecks.ts';
import { isTapCellQuestion, type TapCellQuestion } from '../src/lib/content/schema.ts';
import { plainText } from '../src/lib/markdown/render.ts';
import { continueButton } from './helpers';

const tapDeck = loadDecks('content/decks').find((candidate) => candidate.id === 'tap-the-cell')!;

async function expectNoViolations(page: Page) {
	await page.evaluate(() => Promise.allSettled(document.getAnimations().map((animation) => animation.finished)));
	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target).join(', ')}`)).toEqual(
		[]
	);
}

/** Answers earlier questions correctly until `id` is on screen. */
async function show(page: Page, id: string): Promise<TapCellQuestion> {
	await page.goto(`/play/${tapDeck.id}`);
	for (let step = 0; step < tapDeck.questions.length; step++) {
		await page.getByRole('group', { name: /Tap a cell/ }).waitFor();
		const prompt = (await page.getByRole('region', { name: 'Problem' }).innerText()).replace(/\s+/g, ' ');
		const question = tapDeck.questions.find(
			(candidate) => isTapCellQuestion(candidate) && prompt.includes(plainText(candidate.prompt).replace(/\s+/g, ' ').slice(0, 24))
		);
		if (!question || !isTapCellQuestion(question)) throw new Error('expected a tap-cell question');
		if (question.id === id) return question;
		await page.getByRole('button', { name: new RegExp(`^Index ${question.correct},`) }).click();
		await continueButton(page).click();
	}
	throw new Error(`did not reach ${id}`);
}

test.describe('tap the cell', () => {
	test('a correct tap confirms that cell and moves on', async ({ page }) => {
		await show(page, 'read-at-index');
		await page.getByRole('button', { name: /^Index 1,/ }).click();

		await expect(page.locator('[data-index="1"]')).toHaveAttribute('data-tone', 'correct');
		await expect(page.locator('[data-index="0"]')).toHaveAttribute('data-tone', 'idle');
		const sheet = page.getByRole('region', { name: 'Answer feedback' });
		await expect(sheet.getByRole('heading', { name: 'Well done!' })).toBeVisible();
		await expect(page.locator('#cell-feedback')).toContainText('second cell');
		await expect(sheet.getByRole('button', { name: 'Why?', exact: true })).toHaveCount(0);

		await continueButton(page).click();
		await expect(page.getByText('Follow-up', { exact: true })).toHaveCount(0);
		await expect(page.getByRole('region', { name: 'Answer feedback' })).toHaveCount(0);
	});

	test('a wrong tap stays put, explains itself, and reveals the right cell', async ({ page }) => {
		await show(page, 'read-at-index');
		await page.getByRole('button', { name: /^Index 0,/ }).click();

		await expect(page.locator('[data-index="0"]')).toHaveAttribute('data-tone', 'wrong');
		await expect(page.locator('[data-index="1"]')).toHaveAttribute('data-tone', 'correct');
		await expect(page.locator('#cell-feedback')).toContainText('Counting from 1');
		const sheet = page.getByRole('region', { name: 'Answer feedback' });
		await expect(sheet.getByRole('heading', { name: 'Not quite.' })).toBeVisible();
		await expect(sheet).toContainText('index 1');
		await expect(sheet.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Check', exact: true })).toHaveCount(0);
	});

	test('arrow keys move the focus and Enter answers', async ({ page }) => {
		await page.goto(`/play/${tapDeck.id}`);
		await page.getByRole('group', { name: /Tap a cell/ }).waitFor();
		await page.getByRole('heading', { level: 2 }).focus();
		await page.keyboard.press('Tab');
		await expect(page.getByRole('button', { name: /^Index 0,/ })).toBeFocused();
		await page.keyboard.press('ArrowRight');
		await expect(page.getByRole('button', { name: /^Index 1,/ })).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(page.getByRole('region', { name: 'Answer feedback' })).toBeVisible();
		await expect(page.locator('[data-index="1"]')).not.toHaveAttribute('data-tone', 'idle');
	});

	test('portrait stacks the code over the sequence and landscape places them side by side', async ({ page }) => {
		await page.setViewportSize({ width: 402, height: 874 });
		await page.goto(`/play/${tapDeck.id}`);
		await page.getByRole('group', { name: /Tap a cell/ }).waitFor();
		const portraitCode = await page.locator('.code-pane').boundingBox();
		const portraitBoard = await page.locator('.board-pane').boundingBox();
		expect(portraitBoard!.y).toBeGreaterThan(portraitCode!.y + portraitCode!.height - 4);
		expect(Math.abs(portraitBoard!.x - portraitCode!.x)).toBeLessThan(8);

		await page.setViewportSize({ width: 874, height: 402 });
		const landscapeCode = await page.locator('.code-pane').boundingBox();
		const landscapeBoard = await page.locator('.board-pane').boundingBox();
		expect(landscapeBoard!.x).toBeGreaterThan(landscapeCode!.x + landscapeCode!.width - 4);
		// Side by side means the two panes share a band of the screen. Their tops differ with the
		// font and with how long the shuffled first question's snippet is, so do not compare tops.
		expect(landscapeBoard!.y).toBeLessThan(landscapeCode!.y + landscapeCode!.height);
		expect(landscapeBoard!.y + landscapeBoard!.height).toBeGreaterThan(landscapeCode!.y);
	});

	test('cells are large enough to tap', async ({ page }) => {
		await page.setViewportSize({ width: 402, height: 874 });
		await page.goto(`/play/${tapDeck.id}`);
		const box = await page.getByRole('button', { name: /^Index 0,/ }).boundingBox();
		expect(box!.width).toBeGreaterThanOrEqual(44);
		expect(box!.height).toBeGreaterThanOrEqual(44);
	});

	test('the question and a wrong tap have no accessibility violations', async ({ page }) => {
		await show(page, 'where-right-moves');
		await expect(page.getByText('left', { exact: true }).first()).toBeVisible();
		await expect(page.getByText('right', { exact: true }).first()).toBeVisible();
		await expectNoViolations(page);
		await page.getByRole('button', { name: /^Index 2,/ }).click();
		await expect(page.locator('#cell-feedback')).toBeVisible();
		await expectNoViolations(page);
	});
});
