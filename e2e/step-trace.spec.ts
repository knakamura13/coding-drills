import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { loadDecks } from '../src/lib/content/loadDecks.ts';
import { isCellStep, isStepTraceQuestion, type StepTraceQuestion } from '../src/lib/content/schema.ts';
import { plainText } from '../src/lib/markdown/render.ts';
import { answerCorrectly, continueButton } from './helpers';

const traceDeck = loadDecks('content/decks').find((candidate) => candidate.id === 'trace-the-scan')!;
const questions = traceDeck.questions.filter(isStepTraceQuestion);
const text = (markdown: string) => plainText(markdown, 1000);

async function expectNoViolations(page: Page) {
	await page.evaluate(() => Promise.allSettled(document.getAnimations().map((animation) => animation.finished)));
	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target).join(', ')}`)).toEqual(
		[]
	);
}

/** Which trace is on screen, told apart by the first line of its snippet. */
async function onScreen(page: Page): Promise<StepTraceQuestion> {
	await page.locator('.code .line').first().waitFor();
	const code = await page.locator('.code').innerText();
	const question = questions.find((candidate) => code.includes(candidate.code.split('\n')[0]!.trim()));
	if (!question) throw new Error('expected a step-trace question');
	return question;
}

/** Answers earlier questions right, with every step, until `id` is on screen. */
async function show(page: Page, id: string): Promise<StepTraceQuestion> {
	await page.goto(`/play/${traceDeck.id}`);
	for (let step = 0; step < questions.length; step++) {
		const question = await onScreen(page);
		if (question.id === id) return question;
		await answerCorrectly(page, question);
		await continueButton(page).click();
	}
	throw new Error(`did not reach ${id}`);
}

const firstOf = (question: StepTraceQuestion, kind: 'cell' | 'choice') =>
	question.steps.findIndex((step) => (kind === 'cell') === isCellStep(step));

/** Answers steps right until the learner is on step `index` (0-based). */
async function advanceTo(page: Page, question: StepTraceQuestion, index: number) {
	for (let step = 0; step < index; step++) {
		const current = question.steps[step]!;
		if (isCellStep(current)) {
			await page.getByRole('button', { name: new RegExp(`^Index ${current.correct},`) }).click();
		} else {
			const option = current.options.find((candidate) => candidate.id === current.correct)!;
			await page.getByRole('radio', { name: text(option.text), exact: true }).check();
		}
		await continueButton(page).click();
	}
}

test.describe('step-through trace', () => {
	test('the running line is highlighted and the step counter moves on', async ({ page }) => {
		const question = await show(page, 'trace-sum-to-target');
		await expect(page.getByText(`Step 1 of ${question.steps.length}`)).toBeVisible();
		const first = question.steps[0]!;
		await expect(page.locator('.code .line[aria-current="step"] .no')).toHaveText(String(first.line));
		await advanceTo(page, question, 1);
		await expect(page.getByText(`Step 2 of ${question.steps.length}`)).toBeVisible();
	});

	test('a wrong cell explains itself in place, shows the true cell, and the next step starts from the truth', async ({ page }) => {
		const question = await show(page, 'trace-sum-to-target');
		const step = question.steps[0]!;
		if (!isCellStep(step)) throw new Error('expected a cell step first');
		const miss = step.misses![0]!;
		await page.getByRole('button', { name: new RegExp(`^Index ${miss.index},`) }).click();

		await expect(page.locator(`[data-index="${miss.index}"]`)).toHaveAttribute('data-tone', 'wrong');
		await expect(page.locator(`[data-index="${step.correct}"]`)).toHaveAttribute('data-tone', 'correct');
		await expect(page.locator('#cell-feedback')).toContainText(text(miss.explanation).slice(0, 24));
		await expect(page.getByRole('region', { name: 'Answer feedback' }).getByRole('heading', { name: 'Not quite.' })).toBeVisible();

		await continueButton(page).click();
		// The pointer the step moved is now on its true cell, whatever was picked.
		const moved = step.also![0]!;
		await expect(page.locator('.col', { has: page.locator(`[data-index="${moved.at}"]`) }).locator('.pointer')).toContainText(moved.name);
		await expect(page.getByText(`Step 2 of ${question.steps.length}`)).toBeVisible();
	});

	test('a wrong value shows the explanation written for that option', async ({ page }) => {
		const question = await show(page, 'trace-sum-to-target');
		const index = firstOf(question, 'choice');
		await advanceTo(page, question, index);
		const step = question.steps[index]!;
		if (isCellStep(step)) throw new Error('expected a choice step');
		const wrong = step.options.find((candidate) => candidate.id !== step.correct)!;
		await page.getByRole('radio', { name: text(wrong.text), exact: true }).check();

		const sheet = page.getByRole('region', { name: 'Answer feedback' });
		await expect(sheet.getByRole('heading', { name: 'Not quite.' })).toBeVisible();
		await expect(sheet).toContainText(text(wrong.explanation).slice(0, 24));
		await expect(sheet).toContainText('The correct answer');
		await expect(page.getByRole('radio', { name: text(wrong.text), exact: true })).toBeDisabled();
	});

	test('a whole run answered right records one correct attempt per question', async ({ page }) => {
		await page.goto(`/play/${traceDeck.id}`);
		for (let step = 0; step < questions.length; step++) {
			const question = await onScreen(page);
			await answerCorrectly(page, question);
			await continueButton(page).click();
		}
		await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();
		await expect(page.getByText(`${questions.length} of ${questions.length} right on the first try`)).toBeVisible();
		const attempts = await page.evaluate(() => JSON.parse(localStorage.getItem('coding-drills:v1:attempts') ?? '[]'));
		expect(attempts).toHaveLength(questions.length);
		for (const attempt of attempts) {
			expect(attempt.correct).toBe(true);
			expect(attempt.pickedId.split(',').length).toBeGreaterThanOrEqual(3);
		}
	});

	test('a missed step makes the question a miss and names the step in the summary', async ({ page }) => {
		await page.goto(`/play/${traceDeck.id}`);
		for (let step = 0; step < questions.length; step++) {
			const question = await onScreen(page);
			const first = question.steps[0]!;
			if (!isCellStep(first)) throw new Error('expected a cell step first');
			const wrongIndex = first.misses![0]!.index;
			await page.getByRole('button', { name: new RegExp(`^Index ${wrongIndex},`) }).click();
			await continueButton(page).click();
			// Answer the rest right.
			for (let index = 1; index < question.steps.length; index++) {
				const current = question.steps[index]!;
				if (isCellStep(current)) {
					await page.getByRole('button', { name: new RegExp(`^Index ${current.correct},`) }).click();
				} else {
					const option = current.options.find((candidate) => candidate.id === current.correct)!;
					await page.getByRole('radio', { name: text(option.text), exact: true }).check();
				}
				await continueButton(page).click();
			}
		}
		await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();
		await expect(page.getByText(`0 of ${questions.length} right on the first try`)).toBeVisible();
		await expect(page.getByText('Step 1:').first()).toBeVisible();
	});

	test('arrow keys and Enter answer a cell step', async ({ page }) => {
		await show(page, 'trace-sum-to-target');
		await page.getByRole('heading', { level: 2 }).focus();
		await page.keyboard.press('Tab');
		await expect(page.getByRole('button', { name: /^Index 0,/ })).toBeFocused();
		await page.keyboard.press('ArrowRight');
		await expect(page.getByRole('button', { name: /^Index 1,/ })).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(page.getByRole('region', { name: 'Answer feedback' })).toBeVisible();
	});

	test('a number key answers a value step', async ({ page }) => {
		const question = await show(page, 'trace-sum-to-target');
		await advanceTo(page, question, firstOf(question, 'choice'));
		await page.keyboard.press('1');
		await expect(page.getByRole('region', { name: 'Answer feedback' })).toBeVisible();
	});

	test('portrait stacks the numbered code over the board and landscape places them side by side', async ({ page }) => {
		await page.setViewportSize({ width: 402, height: 874 });
		await page.goto(`/play/${traceDeck.id}`);
		await page.locator('.code .line').first().waitFor();
		const portraitCode = await page.locator('.code-pane').boundingBox();
		const portraitBoard = await page.locator('.board-pane').boundingBox();
		expect(portraitBoard!.y).toBeGreaterThan(portraitCode!.y + portraitCode!.height - 4);
		expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

		await page.setViewportSize({ width: 874, height: 402 });
		const landscapeCode = await page.locator('.code-pane').boundingBox();
		const landscapeBoard = await page.locator('.board-pane').boundingBox();
		expect(landscapeBoard!.x).toBeGreaterThan(landscapeCode!.x + landscapeCode!.width - 4);
		expect(landscapeBoard!.y).toBeLessThan(landscapeCode!.y + landscapeCode!.height);
		expect(landscapeBoard!.y + landscapeBoard!.height).toBeGreaterThan(landscapeCode!.y);
	});

	test('cells are large enough to tap', async ({ page }) => {
		await page.setViewportSize({ width: 402, height: 874 });
		await page.goto(`/play/${traceDeck.id}`);
		await page.locator('.code .line').first().waitFor();
		const box = await page.getByRole('button', { name: /^Index 0,/ }).boundingBox();
		expect(box!.width).toBeGreaterThanOrEqual(44);
		expect(box!.height).toBeGreaterThanOrEqual(44);
	});

	test('a cell step and a wrong value step have no accessibility violations', async ({ page }) => {
		const question = await show(page, 'trace-sum-to-target');
		await expectNoViolations(page);
		const index = firstOf(question, 'choice');
		await advanceTo(page, question, index);
		await expectNoViolations(page);
		const step = question.steps[index]!;
		if (isCellStep(step)) throw new Error('expected a choice step');
		const wrong = step.options.find((candidate) => candidate.id !== step.correct)!;
		await page.getByRole('radio', { name: text(wrong.text), exact: true }).check();
		await expect(page.getByRole('region', { name: 'Answer feedback' })).toBeVisible();
		await expectNoViolations(page);
	});
});
