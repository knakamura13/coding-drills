import { describe, expect, it } from 'vitest';
import { branchOfDeck } from './curriculum.ts';
import { loadCurriculum } from './loadCurriculum.ts';

const curriculum = loadCurriculum('content/curriculum', 'content/decks');

describe('branchOfDeck', () => {
	it('finds the branch through the path a deck drills', () => {
		expect(branchOfDeck(curriculum, 'boundary-search')).toBe('sequences-and-search');
		expect(branchOfDeck(curriculum, 'exact-search')).toBe('sequences-and-search');
	});

	it('is null for a deck no drill maps', () => {
		expect(branchOfDeck(curriculum, 'no-such-deck')).toBeNull();
	});

	it('maps every drilled deck to a branch that exists', () => {
		const branches = new Set(curriculum.branches.map((branch) => branch.id));
		for (const deckId of new Set(curriculum.drills.map((drill) => drill.deckId))) {
			expect(branches.has(branchOfDeck(curriculum, deckId) ?? '')).toBe(true);
		}
	});
});
