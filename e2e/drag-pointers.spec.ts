import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { loadDecks } from '../src/lib/content/loadDecks.ts';
import { isDragPointersQuestion, type DragPointersQuestion } from '../src/lib/content/schema.ts';
import { plainText } from '../src/lib/markdown/render.ts';
import { continueButton } from './helpers';

const dragDeck = loadDecks('content/decks').find((candidate) => candidate.id === 'drag-the-pointers')!;
const questions = dragDeck.questions.filter(isDragPointersQuestion);

async function expectNoViolations(page: Page) {
	await page.evaluate(() => Promise.allSettled(document.getAnimations().map((animation) => animation.finished)));
	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target).join(', ')}`)).toEqual(
		[]
	);
}

const handle = (page: Page, name: string) => page.locator(`[data-pointer="${name}"]`);
const cell = (page: Page, index: number) => page.locator(`[data-index="${index}"]`);

/** Tap a pointer to pick it up, then tap the cell it belongs on. */
async function place(page: Page, name: string, at: number) {
	await handle(page, name).click();
	await cell(page, at).click();
	await expect(handle(page, name)).toHaveAttribute('data-at', String(at));
}

async function onScreen(page: Page): Promise<DragPointersQuestion> {
	await page.getByRole('group', { name: /Drag a pointer/ }).waitFor();
	const prompt = (await page.getByRole('region', { name: 'Problem' }).innerText()).replace(/\s+/g, ' ');
	const question = questions.find((candidate) => prompt.includes(plainText(candidate.prompt).replace(/\s+/g, ' ').slice(0, 24)));
	if (!question) throw new Error('expected a drag-pointers question');
	return question;
}

/** Answers earlier questions correctly until `id` is on screen. */
async function show(page: Page, id: string): Promise<DragPointersQuestion> {
	await page.goto(`/play/${dragDeck.id}`);
	for (let step = 0; step < questions.length; step++) {
		const question = await onScreen(page);
		if (question.id === id) return question;
		for (const pointer of question.pointers) {
			if (pointer.correct !== pointer.start) await place(page, pointer.name, pointer.correct);
		}
		await page.getByRole('button', { name: 'Check', exact: true }).click();
		await continueButton(page).click();
	}
	throw new Error(`did not reach ${id}`);
}

const movingPointer = (question: DragPointersQuestion) => question.pointers.find((pointer) => pointer.start !== pointer.correct)!;

test.describe('drag the pointers', () => {
	test('Check stays off until a pointer moves, then a correct placement is confirmed', async ({ page }) => {
		const question = await show(page, 'sum-step-too-small');
		const check = page.getByRole('button', { name: 'Check', exact: true });
		await expect(check).toBeDisabled();
		const moving = movingPointer(question);
		await place(page, moving.name, moving.correct);
		await expect(check).toBeEnabled();
		await check.click();

		for (const pointer of question.pointers) await expect(handle(page, pointer.name)).toHaveAttribute('data-tone', 'correct');
		const sheet = page.getByRole('region', { name: 'Answer feedback' });
		await expect(sheet.getByRole('heading', { name: 'Well done!' })).toBeVisible();
		await expect(sheet.getByRole('button', { name: 'Why?', exact: true })).toHaveCount(0);
		await continueButton(page).click();
		await expect(page.getByRole('region', { name: 'Answer feedback' })).toHaveCount(0);
	});

	test('a wrong placement explains that pointer in place and shows where it belongs', async ({ page }) => {
		const question = await show(page, 'sum-step-too-small');
		const moving = movingPointer(question);
		const miss = moving.misses![0]!;
		await place(page, moving.name, miss.index);
		await page.getByRole('button', { name: 'Check', exact: true }).click();

		await expect(handle(page, moving.name)).toHaveAttribute('data-tone', 'wrong');
		await expect(handle(page, moving.name)).toHaveAttribute('data-at', String(miss.index));
		const stayed = question.pointers.find((pointer) => pointer.name !== moving.name)!;
		await expect(handle(page, stayed.name)).toHaveAttribute('data-tone', 'correct');
		await expect(page.locator('.pointer.ghost')).toContainText(moving.name);
		await expect(page.locator('#cell-feedback')).toContainText(plainText(miss.explanation).slice(0, 24));
		const sheet = page.getByRole('region', { name: 'Answer feedback' });
		await expect(sheet.getByRole('heading', { name: 'Not quite.' })).toBeVisible();
		await expect(sheet).toContainText(`${moving.name} at ${moving.correct}`);
		await expect(sheet.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
	});

	test('dragging a pointer with the mouse drops it on the nearest cell', async ({ page }) => {
		const question = await show(page, 'sum-step-too-small');
		const moving = movingPointer(question);
		// The board can sit below the fold on a short phone screen, and raw mouse input only reaches what is visible.
		await handle(page, moving.name).scrollIntoViewIfNeeded();
		const from = (await handle(page, moving.name).boundingBox())!;
		const to = (await cell(page, moving.correct).boundingBox())!;
		await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
		await page.mouse.down();
		await page.mouse.move(to.x + to.width / 2 - 6, to.y + to.height / 2, { steps: 8 });
		await expect(cell(page, moving.correct)).toHaveClass(/drop/);
		await page.mouse.up();
		await expect(handle(page, moving.name)).toHaveAttribute('data-at', String(moving.correct));
		await expect(page.getByRole('button', { name: 'Check', exact: true })).toBeEnabled();
	});

	test('arrow keys move a focused pointer and keep it focused', async ({ page }) => {
		const question = await show(page, 'sum-step-too-small');
		const moving = movingPointer(question);
		await handle(page, moving.name).focus();
		await page.keyboard.press('ArrowRight');
		await expect(handle(page, moving.name)).toHaveAttribute('data-at', String(moving.start + 1));
		await expect(handle(page, moving.name)).toBeFocused();
		await page.keyboard.press('ArrowLeft');
		await expect(handle(page, moving.name)).toHaveAttribute('data-at', String(moving.start));
		await page.keyboard.press('Home');
		await expect(handle(page, moving.name)).toHaveAttribute('data-at', '0');
	});

	test('portrait stacks the code over the sequence and landscape places them side by side', async ({ page }) => {
		await page.setViewportSize({ width: 402, height: 874 });
		await page.goto(`/play/${dragDeck.id}`);
		await page.getByRole('group', { name: /Drag a pointer/ }).waitFor();
		const portraitCode = await page.locator('.code-pane').boundingBox();
		const portraitBoard = await page.locator('.board-pane').boundingBox();
		expect(portraitBoard!.y).toBeGreaterThan(portraitCode!.y + portraitCode!.height - 4);

		await page.setViewportSize({ width: 874, height: 402 });
		const landscapeCode = await page.locator('.code-pane').boundingBox();
		const landscapeBoard = await page.locator('.board-pane').boundingBox();
		expect(landscapeBoard!.x).toBeGreaterThan(landscapeCode!.x + landscapeCode!.width - 4);
	});

	test('pointers and cells are large enough to touch', async ({ page }) => {
		await page.setViewportSize({ width: 402, height: 874 });
		await page.goto(`/play/${dragDeck.id}`);
		await page.getByRole('group', { name: /Drag a pointer/ }).waitFor();
		for (const box of [await page.locator('[data-pointer]').first().boundingBox(), await page.locator('[data-index="0"]').boundingBox()]) {
			expect(box!.width).toBeGreaterThanOrEqual(44);
			expect(box!.height).toBeGreaterThanOrEqual(44);
		}
	});

	test('the question and a checked answer have no accessibility violations', async ({ page }) => {
		const question = await show(page, 'sum-step-too-small');
		await expectNoViolations(page);
		const moving = movingPointer(question);
		await place(page, moving.name, moving.misses![0]!.index);
		await page.getByRole('button', { name: 'Check', exact: true }).click();
		await expect(page.locator('#cell-feedback')).toBeVisible();
		await expectNoViolations(page);
	});
});
