import type { Deck, DeckSummary } from '$lib/content/schema';
import type { LessonEntry } from '$lib/domain/lesson';
import { shuffled, type Rng } from '$lib/domain/shuffle';

/** Questions in one mixed-practice sitting. */
export const PRACTICE_SIZE = 10;

export interface TopicCount {
	tag: string;
	count: number;
}

/** Every topic tag across the decks, with how many questions carry it. */
export function topics(decks: readonly DeckSummary[]): TopicCount[] {
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
			.filter((question) => tag === null || (question.tags as readonly string[] | undefined)?.includes(tag))
			.map((question) => ({ deckId: deck.id, heading: deck.heading, question }))
	);
	return shuffled(pool, rng).slice(0, size);
}

const ACRONYMS = new Set(['bfs', 'dfs', 'dp']);

/** "sliding-window" as "Sliding window", and acronyms in capitals. */
export function tagLabel(tag: string): string {
	if (ACRONYMS.has(tag)) return tag.toUpperCase();
	const text = tag.replace(/-/g, ' ');
	return text.charAt(0).toUpperCase() + text.slice(1);
}
