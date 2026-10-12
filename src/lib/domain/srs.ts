import type { Attempt } from '$lib/storage/types';
import { addDays, daysBetween } from './days';

/**
 * Spaced repetition, derived from the attempt log.
 *
 * No schedule is stored. `replay` folds the attempts into a card per question,
 * so devices that hold the same attempts always agree, and a rule change
 * re-derives the schedule from history. Everything here is pure: the clock is
 * always a parameter.
 *
 * Intervals follow the SM-2 family used in learning-korean, in whole days and
 * with no time-of-day component.
 */

const EASE_START = 2.5;
const EASE_FLOOR = 1.3;
const EASE_CEILING = 2.8;
export const MAX_INTERVAL_DAYS = 365;

/** How one finished question went, judged by outcome only. */
export type Grade = 'again' | 'hard' | 'good';

export interface Card {
	deckId: string;
	questionId: string;
	ease: number;
	/** Days between the last counted review and `due`. */
	interval: number;
	/** Consecutive reviews that were not `again`. */
	reps: number;
	lapses: number;
	/** The day the question is next due. */
	due: string;
	/** The day of the last counted review. */
	last: string;
}

/**
 * Right first try is good. Wrong, then the follow-up right, is hard: the
 * learner got there but missed the first time. Wrong twice is again.
 */
export function gradeOf(attempt: Pick<Attempt, 'correct' | 'followUp'>): Grade {
	if (attempt.correct) return 'good';
	return attempt.followUp?.correct ? 'hard' : 'again';
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

export function cardKey(deckId: string, questionId: string): string {
	return `${deckId}/${questionId}`;
}

/** The card after a review on `day`. `prev` is undefined for a question never reviewed. */
export function review(prev: Card | undefined, grade: Grade, day: string, ids: { deckId: string; questionId: string }): Card {
	const base: Card = prev ?? {
		...ids,
		ease: EASE_START,
		interval: 0,
		reps: 0,
		lapses: 0,
		due: day,
		last: day
	};

	if (grade === 'again') {
		return {
			...base,
			ease: clamp(base.ease - 0.2, EASE_FLOOR, EASE_CEILING),
			interval: 1,
			reps: 0,
			lapses: base.lapses + 1,
			due: addDays(day, 1),
			last: day
		};
	}

	let ease = base.ease;
	let interval: number;
	if (grade === 'hard') {
		ease = clamp(ease - 0.15, EASE_FLOOR, EASE_CEILING);
		interval = base.reps === 0 ? 1 : Math.max(1, Math.round(base.interval * 1.2));
	} else {
		interval = base.reps === 0 ? 1 : base.reps === 1 ? 3 : Math.round(base.interval * ease);
	}
	interval = Math.min(MAX_INTERVAL_DAYS, interval);
	return { ...base, ease, interval, reps: base.reps + 1, due: addDays(day, interval), last: day };
}

/**
 * The schedule after every attempt, in order. Only the first attempt on a
 * question each calendar day counts, so retaking a deck the same day does not
 * move the schedule. `attempts` must already be in replay order.
 */
export function replay(attempts: readonly Attempt[]): Map<string, Card> {
	const cards = new Map<string, Card>();
	for (const attempt of countedAttempts(attempts)) {
		const key = cardKey(attempt.deckId, attempt.questionId);
		cards.set(key, review(cards.get(key), gradeOf(attempt), attempt.day, attempt));
	}
	return cards;
}

/** The attempts that count: the first of each question on each calendar day, in the order given. */
export function countedAttempts(attempts: readonly Attempt[]): Attempt[] {
	const seen = new Set<string>();
	return attempts.filter((attempt) => {
		const key = `${cardKey(attempt.deckId, attempt.questionId)}@${attempt.day}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/** Cards due on `today`, most overdue first. Ties break by key so the order is stable. */
export function dueCards(cards: Iterable<Card>, today: string): Card[] {
	return [...cards]
		.filter((card) => card.due <= today)
		.sort(
			(a, b) =>
				(a.due < b.due ? -1 : a.due > b.due ? 1 : 0) ||
				(cardKey(a.deckId, a.questionId) < cardKey(b.deckId, b.questionId) ? -1 : 1)
		);
}

/** Days until the earliest card is due, or null when nothing is scheduled. */
export function daysUntilNextDue(cards: Iterable<Card>, today: string): number | null {
	let next: string | null = null;
	for (const card of cards) if (next === null || card.due < next) next = card.due;
	return next === null ? null : Math.max(0, daysBetween(today, next));
}
