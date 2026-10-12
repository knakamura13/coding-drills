import type { Page } from '@playwright/test';
import { addDays, localDay } from '../src/lib/domain/days.ts';
import { deck } from './helpers';

const ATTEMPTS_KEY = 'coding-drills:v1:attempts';

/** One attempt per deck question on `daysAgo` days before today, the first one missed. */
export function history(daysAgo: number, allRight = false) {
	const day = addDays(localDay(new Date()), -daysAgo);
	return deck.questions.map((question, index) => {
		const wrong = !allRight && index === 0;
		const wrongId = question.options.find((option) => option.id !== question.correct)!.id;
		return {
			id: `seed-${daysAgo}-${question.id}`,
			at: `${day}T12:00:00.000Z`,
			day,
			deckId: deck.id,
			questionId: question.id,
			pickedId: wrong ? wrongId : question.correct,
			correct: !wrong,
			...(wrong ? { followUp: { pickedId: 'x', correct: false } } : {})
		};
	});
}

/** Seeds localStorage once, before the app loads, so a reload keeps what the test later writes. */
export async function seed(page: Page, attempts: unknown[]) {
	await page.addInitScript(
		([key, value]) => {
			if (!localStorage.getItem(key)) localStorage.setItem(key, value);
		},
		[ATTEMPTS_KEY, JSON.stringify(attempts)]
	);
}


/** Every deck question answered wrong, with a wrong follow-up too, `daysAgo` days before today. */
export function failedHistory(daysAgo: number) {
	const day = addDays(localDay(new Date()), -daysAgo);
	return deck.questions.map((question) => ({
		id: `failed-${daysAgo}-${question.id}`,
		at: `${day}T12:00:00.000Z`,
		day,
		deckId: deck.id,
		questionId: question.id,
		pickedId: question.options.find((option) => option.id !== question.correct)!.id,
		correct: false,
		followUp: { pickedId: 'x', correct: false }
	}));
}
