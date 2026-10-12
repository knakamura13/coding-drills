import { describe, expect, it } from 'vitest';
import { seededRng } from '$lib/domain/shuffle';
import { deck } from '$lib/testing/fixtures';
import { PRACTICE_SIZE, practiceEntries, tagLabel, topics } from './practice';

const decks = [
	deck('alpha', [
		{ id: 'a1', tags: ['hash-map'] },
		{ id: 'a2', tags: ['hash-map', 'sorting'] },
		{ id: 'a3' }
	], 'Alpha?'),
	deck('beta', [{ id: 'b1', tags: ['sorting'] }])
];

describe('topics', () => {
	it('lists every tag once with its question count, sorted', () => {
		expect(topics(decks)).toEqual([
			{ tag: 'hash-map', count: 2 },
			{ tag: 'sorting', count: 2 }
		]);
	});
});

describe('practiceEntries', () => {
	it('draws from every deck when no topic is chosen, including untagged questions', () => {
		const entries = practiceEntries(decks, null, seededRng(1));
		expect(entries.map((e) => `${e.deckId}/${e.question.id}`).sort()).toEqual(['alpha/a1', 'alpha/a2', 'alpha/a3', 'beta/b1']);
	});

	it('draws only from questions carrying the topic', () => {
		const entries = practiceEntries(decks, 'sorting', seededRng(2));
		expect(entries.map((e) => `${e.deckId}/${e.question.id}`).sort()).toEqual(['alpha/a2', 'beta/b1']);
	});

	it('returns nothing for an unknown topic', () => {
		expect(practiceEntries(decks, 'nope', seededRng(1))).toEqual([]);
	});

	it('caps a sitting and never repeats a question', () => {
		const big = deck('big', Array.from({ length: 30 }, (_, i) => ({ id: `q${i}` })));
		const entries = practiceEntries([big], null, seededRng(3));
		expect(entries).toHaveLength(PRACTICE_SIZE);
		expect(new Set(entries.map((e) => e.question.id)).size).toBe(PRACTICE_SIZE);
	});

	it('is reproducible for a seed and carries the deck heading', () => {
		const first = practiceEntries(decks, null, seededRng(9));
		expect(practiceEntries(decks, null, seededRng(9)).map((e) => e.question.id)).toEqual(first.map((e) => e.question.id));
		expect(first.find((e) => e.deckId === 'alpha')!.heading).toBe('Alpha?');
	});
});

describe('tagLabel', () => {
	it('turns a kebab-case tag into a readable label', () => {
		expect(tagLabel('sliding-window')).toBe('Sliding window');
		expect(tagLabel('bfs')).toBe('BFS');
		expect(tagLabel('dfs')).toBe('DFS');
	});
});
