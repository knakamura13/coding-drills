import type { Deck } from '$lib/content/schema';
import type { Attempt } from '$lib/storage/types';
import { addDays, weekday } from './days';
import { cardKey, countedAttempts, replay } from './srs';

/** Everything the Progress screen shows, derived from the attempt log. */

export interface DayCell {
	day: string;
	/** Answers given that day, retakes included. */
	count: number;
	/** 0 (nothing) through 4 (a lot), for shading. */
	level: 0 | 1 | 2 | 3 | 4;
}

export function intensity(count: number): DayCell['level'] {
	if (count <= 0) return 0;
	if (count < 5) return 1;
	if (count < 10) return 2;
	if (count < 20) return 3;
	return 4;
}

/** Answers per calendar day. */
export function activity(attempts: readonly Attempt[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const attempt of attempts) counts.set(attempt.day, (counts.get(attempt.day) ?? 0) + 1);
	return counts;
}

/**
 * The last `weeks` weeks as columns of seven days, Sunday first, ending with the
 * week that contains `today`. Days after today are null.
 */
export function calendar(counts: ReadonlyMap<string, number>, today: string, weeks = 12): (DayCell | null)[][] {
	const lastSunday = addDays(today, -weekday(today));
	const start = addDays(lastSunday, -7 * (weeks - 1));
	return Array.from({ length: weeks }, (_, week) =>
		Array.from({ length: 7 }, (_, offset) => {
			const day = addDays(start, week * 7 + offset);
			if (day > today) return null;
			const count = counts.get(day) ?? 0;
			return { day, count, level: intensity(count) };
		})
	);
}

export interface Totals {
	/** Answers that counted toward the schedule. */
	answered: number;
	/** Of those, right on the first try. */
	correct: number;
	/** Distinct days with at least one answer. */
	daysPracticed: number;
}

export function totals(attempts: readonly Attempt[]): Totals {
	const counted = countedAttempts(attempts);
	return {
		answered: counted.length,
		correct: counted.filter((attempt) => attempt.correct).length,
		daysPracticed: new Set(attempts.map((attempt) => attempt.day)).size
	};
}

export interface TopicStat {
	tag: string;
	/** Questions carrying the tag. */
	questions: number;
	/** Answered at least once. */
	seen: number;
	/** Scheduled three or more days out. */
	learned: number;
	/** Counted answers, and how many were right on the first try. */
	answered: number;
	correct: number;
}

/** Per-topic progress. A question with several tags counts toward each. */
export function topicStats(decks: readonly Deck[], attempts: readonly Attempt[]): TopicStat[] {
	const cards = replay(attempts);
	const counted = countedAttempts(attempts);
	const tagsOf = new Map<string, readonly string[]>();
	const stats = new Map<string, TopicStat>();

	for (const deck of decks) {
		for (const question of deck.questions) {
			const key = cardKey(deck.id, question.id);
			const tags = question.tags ?? [];
			tagsOf.set(key, tags);
			const card = cards.get(key);
			for (const tag of tags) {
				const stat = stats.get(tag) ?? { tag, questions: 0, seen: 0, learned: 0, answered: 0, correct: 0 };
				stat.questions += 1;
				if (card) stat.seen += 1;
				if (card && card.interval >= 3) stat.learned += 1;
				stats.set(tag, stat);
			}
		}
	}

	for (const attempt of counted) {
		for (const tag of tagsOf.get(cardKey(attempt.deckId, attempt.questionId)) ?? []) {
			const stat = stats.get(tag);
			if (!stat) continue;
			stat.answered += 1;
			if (attempt.correct) stat.correct += 1;
		}
	}

	return [...stats.values()].sort((a, b) => a.tag.localeCompare(b.tag));
}
