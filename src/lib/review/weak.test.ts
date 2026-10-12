import { describe, expect, it } from 'vitest';
import { attempt, deck } from '$lib/testing/fixtures';
import { WEAK_SIZE, weakStatus } from './weak';

const decks = [deck('alpha', [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }], 'Alpha?'), deck('beta', [{ id: 'b1' }])];

describe('weakStatus', () => {
	it('is empty when nothing has been failed', () => {
		const attempts = [attempt('alpha', 'a1', '2026-10-01'), attempt('alpha', 'a2', '2026-10-01', 'hard')];
		expect(weakStatus(decks, attempts)).toEqual({ count: 0, entries: [] });
	});

	it('ranks by failures, then by the most recent review, and carries the deck heading', () => {
		const attempts = [
			attempt('alpha', 'a1', '2026-10-01', 'again'),
			attempt('alpha', 'a2', '2026-10-01', 'again'),
			attempt('alpha', 'a2', '2026-10-02', 'again'),
			attempt('beta', 'b1', '2026-10-05', 'again'),
			attempt('alpha', 'a3', '2026-10-01')
		];
		const status = weakStatus(decks, attempts);
		expect(status.count).toBe(3);
		expect(status.entries.map((entry) => `${entry.deckId}/${entry.question.id}`)).toEqual([
			'alpha/a2',
			'beta/b1',
			'alpha/a1'
		]);
		expect(status.entries[0].heading).toBe('Alpha?');
		expect(status.entries[1].heading).toBeUndefined();
	});

	it('keeps a question weak after it is answered well again, since the lapse is history', () => {
		const attempts = [attempt('alpha', 'a1', '2026-10-01', 'again'), attempt('alpha', 'a1', '2026-10-02')];
		expect(weakStatus(decks, attempts).count).toBe(1);
	});

	it('limits a sitting but reports the full count, and skips questions that no longer exist', () => {
		const many = deck('many', Array.from({ length: 14 }, (_, i) => ({ id: `m${i}` })));
		const attempts = [
			...many.questions.map((q) => attempt('many', q.id, '2026-10-01', 'again')),
			attempt('gone', 'x', '2026-10-01', 'again')
		];
		const status = weakStatus([many], attempts);
		expect(status.count).toBe(14);
		expect(status.entries).toHaveLength(WEAK_SIZE);
	});
});
