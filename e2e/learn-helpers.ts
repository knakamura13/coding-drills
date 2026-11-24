import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { loadDecks } from '../src/lib/content/loadDecks.ts';
import {
	isCellStep,
	isChoiceQuestion,
	isDragPointersQuestion,
	isStepTraceQuestion,
	isTapCellQuestion,
	type ChoiceQuestion,
	type DragPointersQuestion,
	type Question,
	type StepTraceQuestion,
	type TapCellQuestion
} from '../src/lib/content/schema.ts';
import { plainText } from '../src/lib/markdown/render.ts';
import { seed } from './seed.ts';

// Helpers for driving the new lesson screen on /learn/<deck>, shared by its specs.

export const decks = loadDecks('content/decks');
export const deck = decks.find((candidate) => candidate.id === 'boundary-search')!;
export const questions = deck.questions.filter(isChoiceQuestion);
export const shown = deck.questions;
export const URL = `/learn/${deck.id}`;
export const cellsDeck = decks.find((candidate) => candidate.id === 'tap-the-cell')!;
export const cellQuestions = cellsDeck.questions.filter(isTapCellQuestion);

export const tiles = (page: Page) => page.getByRole('group', { name: /./ }).locator('label, button');
export const cell = (page: Page, index: number) => page.getByRole('radio', { name: new RegExp(`^Index ${index},`) });
export const labelledCells = (page: Page) => page.locator('[aria-label^="Index "]');
// Check in the footer, or Continue in the feedback panel that replaces it.
export const primary = (page: Page) => page.getByRole('button', { name: /^(Check|Continue|Next step)$/ });
/** A trace's "Step n of m" line. */
export const stepCount = (page: Page) => page.locator('main').getByText(/^Step \d+ of \d+$/);
export const panel = (page: Page) => page.getByRole('region', { name: /^(Correct|Not quite)$/ });

/**
 * One old answer in every deck, saved before the app loads. On a deck with no answers the worked
 * example opens by itself over the first question (lesson Round 2), so specs that are about
 * something else start from a deck the learner has seen.
 */
export async function seenEveryDeck(page: Page) {
	await seed(
		page,
		decks.map((candidate) => ({
			id: `seen-${candidate.id}`,
			at: '2026-01-01T12:00:00.000Z',
			day: '2026-01-01',
			deckId: candidate.id,
			questionId: candidate.questions[0]!.id,
			pickedId: 'seen',
			correct: true
		}))
	);
}

// The new UI keeps its fades under reduced motion, so axe waits for them: mid-fade, text shows
// through a half-transparent sheet or panel and fails contrast it passes once settled.
export async function violations(page: Page) {
	await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)));
	return (await new AxeBuilder({ page }).analyze()).violations;
}

/** Which deck question is on screen, from its answer labels. */
/** Between steps the old card slides out for 150 ms; read the screen once it has gone. */
export async function settled(page: Page) {
	await expect(page.locator('[data-leaving]')).toHaveCount(0);
}

export async function current(page: Page, pool: ChoiceQuestion[] = questions): Promise<ChoiceQuestion> {
	await settled(page);
	await tiles(page).first().waitFor();
	const answers = (await tiles(page).allInnerTexts()).map((label) => label.trim()).sort();
	const match = pool.find(
		(question) =>
			JSON.stringify(question.options.map((option) => plainText(option.text, 1000)).sort()) === JSON.stringify(answers)
	);
	if (!match) throw new Error(`no question has these answers: ${answers.join(' | ')}`);
	return match;
}

/** The values a tap or drag question's cells show, as their accessible names spell them. */
export const cellValues = (question: TapCellQuestion | DragPointersQuestion | StepTraceQuestion) => [
	...question.sequence.cells.map((value) => (value === '' ? 'empty' : value)),
	...(question.sequence.pastEnd ? ['past the end'] : [])
];

/** Which question is on screen, of either format: cells by their values, tiles by their answers. */
export async function onScreen(page: Page, pool: Question[] = shown): Promise<Question> {
	await settled(page);
	await page.locator('fieldset').first().waitFor();
	const names = await labelledCells(page).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')!));
	if (names.length === 0) return current(page, pool.filter(isChoiceQuestion));
	const values = names.map((name) => name.match(/^Index \d+, (.*?)(, marked .*)?$/)![1]);
	if ((await stepCount(page).count()) > 0) {
		const ask = (await page.locator('main').getByRole('heading', { level: 2 }).innerText()).trim();
		const trace = pool
			.filter(isStepTraceQuestion)
			.find(
				(question) =>
					JSON.stringify(cellValues(question)) === JSON.stringify(values) && question.steps.some((step) => plainText(step.ask, 1000) === ask)
			);
		if (!trace) throw new Error(`no trace has these cells and this ask: ${values.join(' | ')} / ${ask}`);
		return trace;
	}
	const tabs = (await page.locator('[data-pointer]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-pointer')!))).sort();
	if (tabs.length > 0) {
		const drag = pool
			.filter(isDragPointersQuestion)
			.find(
				(question) =>
					JSON.stringify(cellValues(question)) === JSON.stringify(values) &&
					JSON.stringify(question.pointers.map((pointer) => pointer.name).sort()) === JSON.stringify(tabs)
			);
		if (!drag) throw new Error(`no drag question has these cells and pointers: ${values.join(' | ')} / ${tabs.join(' ')}`);
		return drag;
	}
	const match = pool.filter(isTapCellQuestion).find((question) => JSON.stringify(cellValues(question)) === JSON.stringify(values));
	if (!match) throw new Error(`no question has these cells: ${values.join(' | ')}`);
	return match;
}

/** A multiple-choice question first: the lesson order is random, so reload until one leads. */
export async function firstChoice(page: Page): Promise<ChoiceQuestion> {
	for (let attempt = 0; attempt < 30; attempt++) {
		await settled(page);
		await page.locator('fieldset').first().waitFor();
		if ((await labelledCells(page).count()) === 0) return current(page);
		await page.goto(URL);
	}
	throw new Error('a multiple-choice question never came first');
}

/** Moves a pointer from the keyboard: Home to the first cell, then right to `index`. */
export async function placePointer(page: Page, pointer: string, index: number) {
	const tab = page.locator(`[data-pointer="${pointer}"]`);
	await tab.focus();
	await page.keyboard.press('Home');
	for (let step = 0; step < index; step++) await page.keyboard.press('ArrowRight');
	await expect(tab).toHaveAccessibleName(new RegExp(`at index ${index}\\b`));
}

/** Continue past an answered question, and wait for its card to leave, so the next read sees the next question. */
export async function next(page: Page) {
	const card = await page.locator('.content:not([data-leaving])').elementHandle();
	await primary(page).click();
	await card?.waitForElementState('hidden');
}

/**
 * Answers every step of a trace with Check, right except the steps in `wrong`, then Continues.
 * A wrong cell is the first targeted miss, or a neighbor of the right cell.
 */
export async function answerTrace(page: Page, question: StepTraceQuestion, wrong: readonly number[] = []) {
	for (const [index, step] of question.steps.entries()) {
		await expect(stepCount(page)).toHaveText(`Step ${index + 1} of ${question.steps.length}`);
		const right = !wrong.includes(index);
		if (isCellStep(step)) {
			const miss = step.misses?.[0]?.index ?? (step.correct === 0 ? 1 : step.correct - 1);
			await cell(page, right ? step.correct : miss).check();
		} else {
			const option = step.options.find((candidate) => (candidate.id === step.correct) === right)!;
			await pick(page, plainText(option.text, 1000));
		}
		await primary(page).click();
		if (index < question.steps.length - 1) await page.getByRole('button', { name: 'Next step' }).click();
		else await next(page);
	}
}

/** Answers right with Check, then Continues. A right answer never opens a follow-up. */
export async function answerRight(page: Page, question: Question) {
	if (isStepTraceQuestion(question)) return answerTrace(page, question);
	if (isDragPointersQuestion(question)) for (const pointer of question.pointers) await placePointer(page, pointer.name, pointer.correct);
	else if (isTapCellQuestion(question)) await cell(page, question.correct).check();
	else if (isChoiceQuestion(question)) await pick(page, optionLabel(question, question.correct));
	await primary(page).click();
	await next(page);
}

export const optionLabel = (question: ChoiceQuestion, id: string) => plainText(question.options.find((o) => o.id === id)!.text, 1000);

export async function pick(page: Page, label: string) {
	await page.getByRole('radio', { name: label, exact: true }).check();
}

/**
 * Answers wrong and Continues. A multiple-choice miss opens its follow-up, answered right or wrong
 * as asked and Continued too; a missed cell has no follow-up.
 */
export async function answerWrong(page: Page, question: Question, followUpRight = true) {
	if (isDragPointersQuestion(question)) {
		// The first pointer one cell off its answer; a drag answer has no follow-up.
		const [first] = question.pointers;
		const last = question.sequence.cells.length + (question.sequence.pastEnd ? 1 : 0) - 1;
		await placePointer(page, first!.name, first!.correct === 0 ? 1 : Math.min(last, first!.correct - 1));
		await primary(page).click();
		await next(page);
		return;
	}
	if (isStepTraceQuestion(question)) return answerTrace(page, question, [0]);
	if (isTapCellQuestion(question)) {
		await cell(page, question.misses[0]!.index).check();
		await primary(page).click();
		await next(page);
		return;
	}
	if (!isChoiceQuestion(question)) return;
	const wrong = question.options.find((option) => option.id !== question.correct)!;
	await pick(page, plainText(wrong.text, 1000));
	await primary(page).click();
	await primary(page).click();
	const followUp = question.followUps[wrong.id]!;
	const target = followUp.options.find((option) => (option.id === followUp.correct) === followUpRight)!;
	await pick(page, plainText(target.text, 1000));
	await primary(page).click();
	await next(page);
}

/** Opens a deck and answers right until the given question is on screen. */
export async function reach(page: Page, deckId: string, questionId: string): Promise<Question> {
	const pool = decks.find((candidate) => candidate.id === deckId)!.questions;
	await page.goto(`/learn/${deckId}`);
	for (let step = 0; step < pool.length; step++) {
		const question = await onScreen(page, pool);
		if (question.id === questionId) return question;
		await answerRight(page, question);
	}
	throw new Error(`${questionId} never came up in ${deckId}`);
}
