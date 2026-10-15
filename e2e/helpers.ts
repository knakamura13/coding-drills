import { expect, type Page } from '@playwright/test';
import { loadDecks } from '../src/lib/content/loadDecks.ts';
import type { Question } from '../src/lib/content/schema.ts';
import { plainText } from '../src/lib/markdown/render.ts';

/** The shipped deck is the fixture, so these tests also guard the content. */
export const deck = loadDecks('content/decks').find((candidate) => candidate.id === 'pattern-identification')!;
export const DECK_URL = `/play/${deck.id}`;

export const allDecks = loadDecks('content/decks');

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

/**
 * Like `currentQuestion`, but across every deck, for sessions that mix them. Questions whose
 * options read the same are told apart by their problem text.
 */
export async function currentQuestionAny(page: Page): Promise<{ question: Question; deckId: string }> {
	await page.getByRole('radio').first().waitFor();
	const shown = (await page.locator('fieldset label').allInnerTexts()).map((label) => label.trim()).sort();
	const candidates = allDecks.flatMap((candidateDeck) =>
		candidateDeck.questions
			.filter((candidate) => JSON.stringify(candidate.options.map((option) => text(option.text)).sort()) === JSON.stringify(shown))
			.map((question) => ({ question, deckId: candidateDeck.id }))
	);
	if (candidates.length === 0) throw new Error(`no question has these options: ${shown.join(' | ')}`);
	if (candidates.length === 1) return candidates[0];
	const page_text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
	const match = candidates.find(({ question }) => page_text.includes(text(question.prompt).replace(/\s+/g, ' ').slice(0, 40)));
	return match ?? candidates[0];
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

/** Leaves a wrong main answer: Why?, Got it, Continue. Does not answer the follow-up. */
export async function continuePastWrong(page: Page) {
	await page.getByRole('button', { name: 'Why?', exact: true }).click();
	await page.getByRole('dialog', { name: 'Why the answers differ' }).getByRole('button', { name: 'Got it' }).click();
	await continueButton(page).click();
}

/**
 * Opens the menu from the top bar. A prerendered page ignores a click until it has hydrated, and WebKit can
 * finish that after the load event, so the click is repeated until the drawer is open.
 */
export async function openMenu(page: Page): Promise<void> {
	const drawer = page.getByRole('dialog', { name: 'Menu' });
	await expect(async () => {
		if (!(await drawer.isVisible())) await page.getByRole('button', { name: /^Menu/ }).click();
		await expect(drawer).toBeVisible({ timeout: 1000 });
	}).toPass({ timeout: 15_000 });
}

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
			await continuePastWrong(page);
			await page.getByText('Follow-up', { exact: true }).waitFor();
			await answerFollowUp(page, question, step.main, step.followUpRight ?? false);
			await continueButton(page).click();
		}
	}
}
