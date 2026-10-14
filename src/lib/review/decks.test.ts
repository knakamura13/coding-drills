import { describe, expect, it } from 'vitest';
import { deck } from '$lib/testing/fixtures';
import { filterDecks, suggestedDeck } from './decks';
import type { DeckProgress } from './queue';

const alpha = deck('alpha', [{ id: 'a1' }, { id: 'a2' }]);
const beta = deck('beta', [{ id: 'b1' }]);
const gamma = deck('gamma', [{ id: 'g1' }]);
const decks = [alpha, beta, gamma];

/** Progress for every deck. Anything not given starts at nothing seen, nothing due. */
function progressOf(stats: Record<string, Partial<DeckProgress>>): Map<string, DeckProgress> {
	return new Map(decks.map((d) => [d.id, { seen: 0, learned: 0, due: 0, ...stats[d.id] }]));
}

describe('suggestedDeck', () => {
	it('offers the first deck before anything is studied', () => {
		expect(suggestedDeck(decks, progressOf({}), null)).toBe(alpha);
	});

	it('keeps the deck studied last while it still has work', () => {
		// beta is done for now but has a question due, and alpha has unseen questions.
		const progress = progressOf({ beta: { seen: 1, due: 1 } });
		expect(suggestedDeck(decks, progress, 'beta')).toBe(beta);
	});

	it('moves past a finished deck to the next one with work', () => {
		const progress = progressOf({ alpha: { seen: 2 } });
		expect(suggestedDeck(decks, progress, 'alpha')).toBe(beta);
	});

	it('offers the deck studied last again when nothing is left to do', () => {
		const progress = progressOf({
			alpha: { seen: 2 },
			beta: { seen: 1 },
			gamma: { seen: 1 }
		});
		expect(suggestedDeck(decks, progress, 'beta')).toBe(beta);
	});

	it('ignores a last-studied deck that no longer exists', () => {
		expect(suggestedDeck(decks, progressOf({}), 'removed')).toBe(alpha);
	});

	it('has nothing to offer without decks', () => {
		expect(suggestedDeck([], new Map(), null)).toBeNull();
	});
});

describe('filterDecks', () => {
	const listed = [
		{ title: 'Heaps and top-k', description: 'Priority queues for the k largest' },
		{ title: 'Trees', description: 'Traversals and BST' }
	];

	it('keeps every deck, in order, for an empty query', () => {
		expect(filterDecks(listed, '   ')).toEqual(listed);
	});

	it('matches the title or the description, ignoring case', () => {
		expect(filterDecks(listed, 'HEAP')).toEqual([listed[0]]);
		expect(filterDecks(listed, 'traversal')).toEqual([listed[1]]);
	});

	it('needs every word to match somewhere in the deck', () => {
		expect(filterDecks(listed, 'heap tree')).toEqual([]);
		expect(filterDecks(listed, 'priority largest')).toEqual([listed[0]]);
	});

	it('returns nothing when no deck matches', () => {
		expect(filterDecks(listed, 'graphs')).toEqual([]);
	});
});
