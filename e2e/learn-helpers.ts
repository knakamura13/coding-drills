import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { loadDecks } from '../src/lib/content/loadDecks.ts';
import { isChoiceQuestion, isTapCellQuestion, type ChoiceQuestion, type Question, type TapCellQuestion } from '../src/lib/content/schema.ts';
import { plainText } from '../src/lib/markdown/render.ts';
import { seed } from './seed.ts';

// Helpers for driving the new lesson screen on /learn/<deck>, shared by its specs.

export const decks = loadDecks('content/decks');
export const runs = (question: Question) => isChoiceQuestion(question) || isTapCellQuestion(question);
export const deck = decks.find((candidate) => candidate.id === 'boundary-search')!;
export const questions = deck.questions.filter(isChoiceQuestion);
export const shown = deck.questions.filter(runs);
export const URL = `/learn/${deck.id}`;
export const cellsDeck = decks.find((candidate) => candidate.id === 'tap-the-cell')!;
export const cellQuestions = cellsDeck.questions.filter(isTapCellQuestion);

export const tiles = (page: Page) => page.getByRole('group', { name: /./ }).locator('label, button');
export const cell = (page: Page, index: number) => page.getByRole('radio', { name: new RegExp(`^Index ${index},`) });
export const labelledCells = (page: Page) => page.locator('[aria-label^="Index "]');
// Check in the footer, or Continue in the feedback panel that replaces it.
export const primary = (page: Page) => page.getByRole('button', { name: /^(Check|Continue)$/ });
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

/** The values a tap question's cells show, as their accessible names spell them. */
export const cellValues = (question: TapCellQuestion) => [
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

/** Answers right with Check, then Continues. A right answer never opens a follow-up. */
export async function answerRight(page: Page, question: Question) {
	if (isTapCellQuestion(question)) await cell(page, question.correct).check();
	else if (isChoiceQuestion(question)) await pick(page, optionLabel(question, question.correct));
	await primary(page).click();
	await primary(page).click();
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
	if (isTapCellQuestion(question)) {
		await cell(page, question.misses[0]!.index).check();
		await primary(page).click();
		await primary(page).click();
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
	await primary(page).click();
}
