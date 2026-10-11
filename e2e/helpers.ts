import type { Page } from '@playwright/test';
import { loadDecks } from '../src/lib/content/loadDecks.ts';
import type { Question } from '../src/lib/content/schema.ts';
import { plainText } from '../src/lib/markdown/render.ts';

/** The shipped deck is the fixture, so these tests also guard the content. */
export const deck = loadDecks('content/decks').find((candidate) => candidate.id === 'pattern-identification')!;
export const DECK_URL = `/play/${deck.id}`;

const text = (markdown: string) => plainText(markdown, 1000);

export function optionOf(question: Question, optionId: string) {
	const option = question.options.find((candidate) => candidate.id === optionId);
	if (!option) throw new Error(`no option ${optionId} on ${question.id}`);
	return option;
}

export function firstWrongId(question: Question): string {
	return question.options.find((option) => option.id !== question.correct)!.id;
}

/** Finds which deck question is on screen by comparing its option labels. */
export async function currentQuestion(page: Page): Promise<Question> {
	await page.getByRole('radio').first().waitFor();
	const shown = (await page.locator('fieldset label').allInnerTexts()).map((label) => label.trim()).sort();
	const match = deck.questions.find((candidate) => {
		const expected = candidate.options.map((option) => text(option.text)).sort();
		return JSON.stringify(expected) === JSON.stringify(shown);
	});
	if (!match) throw new Error(`no deck question has these options: ${shown.join(' | ')}`);
	return match;
}

export async function pickAndCheck(page: Page, label: string) {
	await page.getByRole('radio', { name: label, exact: true }).check();
	await page.getByRole('button', { name: 'Check', exact: true }).click();
}

export async function answerMain(page: Page, question: Question, optionId: string) {
	await pickAndCheck(page, text(optionOf(question, optionId).text));
}

export async function answerFollowUp(page: Page, question: Question, mainPick: string, right: boolean) {
	const followUp = question.followUps[mainPick];
	const target = right
		? followUp.correct
		: followUp.options.find((option) => option.id !== followUp.correct)!.id;
	const option = followUp.options.find((candidate) => candidate.id === target)!;
	await pickAndCheck(page, text(option.text));
}

export const continueButton = (page: Page) => page.getByRole('button', { name: 'Continue', exact: true });

export interface Plan {
	/** Option to pick on the main question: 'right' or a wrong option id. */
	main: 'right' | string;
	/** For a wrong main pick: whether the follow-up is answered correctly. */
	followUpRight?: boolean;
}

/**
 * Plays the deck, choosing each answer from `plan(question, index)`. Pass
 * `alreadyDone` when some questions were answered by hand first.
 */
export async function playDeck(
	page: Page,
	plan: (question: Question, index: number) => Plan,
	alreadyDone = 0
) {
	for (let index = alreadyDone; index < deck.questions.length; index++) {
		const question = await currentQuestion(page);
		const step = plan(question, index);
		if (step.main === 'right') {
			await answerMain(page, question, question.correct);
			await continueButton(page).click();
		} else {
			await answerMain(page, question, step.main);
			await continueButton(page).click();
			await page.getByText('Follow-up', { exact: true }).waitFor();
			await answerFollowUp(page, question, step.main, step.followUpRight ?? false);
			await continueButton(page).click();
		}
	}
}
