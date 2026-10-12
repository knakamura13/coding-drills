import type { Deck, Question } from '$lib/content/schema';
import type { LessonEntry } from '$lib/domain/lesson';
import { cardKey, replay } from '$lib/domain/srs';
import type { Attempt } from '$lib/storage/types';

/** Questions in one weak-spots sitting. */
export const WEAK_SIZE = 10;

export interface WeakStatus {
	/** Questions you have failed at least once, before the sitting limit. */
	count: number;
	/** The ones failed most often, up to the limit. */
	entries: LessonEntry[];
}

/**
 * The questions you have failed (wrong, then the follow-up wrong too) most
 * often. Ties go to the most recent review, so what you are currently getting
 * wrong comes first. This ignores the schedule on purpose: it is for practicing
 * trouble spots whether or not they are due.
 */
export function weakStatus(decks: readonly Deck[], attempts: readonly Attempt[], limit = WEAK_SIZE): WeakStatus {
	const questions = new Map<string, { question: Question; deck: Deck }>();
	for (const deck of decks) {
		for (const question of deck.questions) questions.set(cardKey(deck.id, question.id), { question, deck });
	}

	const weak = [...replay(attempts).values()]
		.filter((card) => card.lapses > 0 && questions.has(cardKey(card.deckId, card.questionId)))
		.sort(
			(a, b) =>
				b.lapses - a.lapses ||
				(a.last < b.last ? 1 : a.last > b.last ? -1 : 0) ||
				(cardKey(a.deckId, a.questionId) < cardKey(b.deckId, b.questionId) ? -1 : 1)
		);

	return {
		count: weak.length,
		entries: weak.slice(0, limit).map((card) => {
			const { question, deck } = questions.get(cardKey(card.deckId, card.questionId))!;
			return { deckId: deck.id, heading: deck.heading, question };
		})
	};
}
