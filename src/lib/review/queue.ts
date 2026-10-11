import type { Deck, Question } from '$lib/content/schema';
import { daysUntilNextDue, dueCards, replay } from '$lib/domain/srs';
import type { Attempt } from '$lib/storage/types';

/** Questions in one review sitting. */
export const REVIEW_SIZE = 10;

export interface ReviewEntry {
	deckId: string;
	question: Question;
}

export interface ReviewStatus {
	/** Questions due today, before the sitting limit. */
	dueCount: number;
	/** The most overdue questions, up to the sitting limit. */
	entries: ReviewEntry[];
	/** Days until the next question is due when none is due now. Null when nothing is scheduled. */
	nextInDays: number | null;
}

/**
 * What a review sitting would contain today. Questions whose deck or id no
 * longer exists are skipped: content can be rewritten after attempts were logged.
 */
export function reviewStatus(
	decks: readonly Deck[],
	attempts: readonly Attempt[],
	today: string,
	limit = REVIEW_SIZE
): ReviewStatus {
	const questions = new Map<string, Question>();
	for (const deck of decks) {
		for (const question of deck.questions) questions.set(`${deck.id}/${question.id}`, question);
	}

	const cards = [...replay(attempts).values()].filter((card) =>
		questions.has(`${card.deckId}/${card.questionId}`)
	);
	const due = dueCards(cards, today);
	return {
		dueCount: due.length,
		entries: due.slice(0, limit).map((card) => ({
			deckId: card.deckId,
			question: questions.get(`${card.deckId}/${card.questionId}`)!
		})),
		nextInDays: due.length > 0 ? 0 : daysUntilNextDue(cards, today)
	};
}

export interface DeckProgress {
	/** Questions answered at least once. */
	seen: number;
	/** Questions answered well enough to be scheduled 3 or more days out. */
	learned: number;
	/** Questions due today. */
	due: number;
}

/** How far along each deck is, keyed by deck id. */
export function deckProgress(
	decks: readonly Deck[],
	attempts: readonly Attempt[],
	today: string
): Map<string, DeckProgress> {
	const cards = replay(attempts);
	return new Map(
		decks.map((deck) => {
			const progress: DeckProgress = { seen: 0, learned: 0, due: 0 };
			for (const question of deck.questions) {
				const card = cards.get(`${deck.id}/${question.id}`);
				if (!card) continue;
				progress.seen += 1;
				if (card.interval >= 3) progress.learned += 1;
				if (card.due <= today) progress.due += 1;
			}
			return [deck.id, progress];
		})
	);
}
