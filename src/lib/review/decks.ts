import type { DeckSummary } from '$lib/content/schema';
import type { DeckProgress } from './queue';

/**
 * The deck the home screen offers next. A deck with work left (a question not
 * seen yet, or one due today) is the choice. The deck studied last is kept while
 * it still has work, so a session picks up where it stopped. When no deck has
 * work left, the deck studied last is offered again.
 */
export function suggestedDeck(
	decks: readonly DeckSummary[],
	progress: ReadonlyMap<string, DeckProgress>,
	lastStudiedId: string | null
): DeckSummary | null {
	const hasWork = (deck: DeckSummary) => {
		const stat = progress.get(deck.id);
		return !stat || stat.seen < deck.questions.length || stat.due > 0;
	};
	const last = decks.find((deck) => deck.id === lastStudiedId);
	if (last && hasWork(last)) return last;
	return decks.find(hasWork) ?? last ?? null;
}

/**
 * Decks whose title or description contains every word of `query`, ignoring
 * case. An empty query keeps every deck, in its original order.
 */
export function filterDecks<T extends { title: string; description: string }>(decks: readonly T[], query: string): T[] {
	const words = query.toLowerCase().split(/\s+/).filter((word) => word.length > 0);
	if (words.length === 0) return [...decks];
	return decks.filter((deck) => {
		const text = `${deck.title} ${deck.description}`.toLowerCase();
		return words.every((word) => text.includes(word));
	});
}
