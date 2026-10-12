import type { Deck } from '$lib/content/schema';
import type { LessonEntry } from '$lib/domain/lesson';
import { shuffled, type Rng } from '$lib/domain/shuffle';

/** Questions in one mixed-practice sitting. */
export const PRACTICE_SIZE = 10;

export interface TopicCount {
	tag: string;
	count: number;
}

/** Every topic tag across the decks, with how many questions carry it. */
export function topics(decks: readonly Deck[]): TopicCount[] {
	const counts = new Map<string, number>();
	for (const deck of decks) {
		for (const question of deck.questions) {
			for (const tag of question.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
		}
	}
	return [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => a.tag.localeCompare(b.tag));
}

/** A random sitting from every deck, or only from questions carrying `tag`. */
export function practiceEntries(
	decks: readonly Deck[],
	tag: string | null,
	rng: Rng = Math.random,
	size = PRACTICE_SIZE
): LessonEntry[] {
	const pool: LessonEntry[] = decks.flatMap((deck) =>
		deck.questions
			.filter((question) => tag === null || (question.tags ?? []).includes(tag))
			.map((question) => ({ deckId: deck.id, heading: deck.heading, question }))
	);
	return shuffled(pool, rng).slice(0, size);
}

/** "sliding-window" as "Sliding window". */
export function tagLabel(tag: string): string {
	const text = tag.replace(/-/g, ' ');
	return text.charAt(0).toUpperCase() + text.slice(1);
}
