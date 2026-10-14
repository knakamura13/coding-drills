import type { Deck, DeckSummary, Question } from '$lib/content/schema';
import type { LessonEntry } from '$lib/domain/lesson';
import { cardKey, daysUntilNextDue, dueCards, replay } from '$lib/domain/srs';
import type { Attempt } from '$lib/storage/types';

/** Questions in one review sitting. */
export const REVIEW_SIZE = 10;

/** What the schedule holds today. */
export interface ScheduleCounts {
	/** Questions due today, before the sitting limit. */
	dueCount: number;
	/** Days until the next question is due when none is due now. Null when nothing is scheduled. */
	nextInDays: number | null;
}

export interface ReviewStatus extends ScheduleCounts {
	/** The most overdue questions, up to the sitting limit. */
	entries: LessonEntry[];
}

/** Cards for questions that still exist, and the ones due today, most overdue first. */
function scheduled(decks: readonly DeckSummary[], attempts: readonly Attempt[], today: string) {
	const known = new Set(decks.flatMap((deck) => deck.questions.map((question) => cardKey(deck.id, question.id))));
	const cards = [...replay(attempts).values()].filter((card) => known.has(cardKey(card.deckId, card.questionId)));
	return { cards, due: dueCards(cards, today) };
}

/**
 * The schedule's counts, from deck and question ids alone. The menu, the home
 * screen, and the summary use this, so they never load question text.
 */
export function scheduleCounts(decks: readonly DeckSummary[], attempts: readonly Attempt[], today: string): ScheduleCounts {
	const { cards, due } = scheduled(decks, attempts, today);
	return { dueCount: due.length, nextInDays: due.length > 0 ? 0 : daysUntilNextDue(cards, today) };
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
	const headings = new Map(decks.map((deck) => [deck.id, deck.heading]));
	for (const deck of decks) {
		for (const question of deck.questions) questions.set(cardKey(deck.id, question.id), question);
	}

	const { cards, due } = scheduled(decks, attempts, today);
	return {
		dueCount: due.length,
		entries: due.slice(0, limit).map((card) => ({
			deckId: card.deckId,
			heading: headings.get(card.deckId),
			question: questions.get(cardKey(card.deckId, card.questionId))!
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
	decks: readonly DeckSummary[],
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
