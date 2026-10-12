import { describe, expect, it } from 'vitest';
import { attempt, deck } from '$lib/testing/fixtures';
import { activity, calendar, intensity, topicStats, totals } from './stats';

describe('intensity', () => {
	it('shades by how many answers were given', () => {
		expect([0, 1, 4, 5, 9, 10, 19, 20, 99].map(intensity)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
	});
});

describe('activity and totals', () => {
	const attempts = [
		attempt('d', 'a', '2026-10-10'),
		attempt('d', 'a', '2026-10-10', 'again'),
		attempt('d', 'b', '2026-10-10', 'again'),
		attempt('d', 'a', '2026-10-11')
	];

	it('counts every answer per day, retakes included', () => {
		expect([...activity(attempts)]).toEqual([
			['2026-10-10', 3],
			['2026-10-11', 1]
		]);
	});

	it('totals only the answers that count toward the schedule', () => {
		// The retake of "a" on the 10th does not count.
		expect(totals(attempts)).toEqual({ answered: 3, correct: 2, daysPracticed: 2 });
		expect(totals([])).toEqual({ answered: 0, correct: 0, daysPracticed: 0 });
	});
});

describe('calendar', () => {
	// 2026-10-14 is a Wednesday.
	const today = '2026-10-14';

	it('lays out weeks Sunday first and ends with the week containing today', () => {
		const weeks = calendar(new Map(), today, 2);
		expect(weeks).toHaveLength(2);
		expect(weeks[0][0]!.day).toBe('2026-10-04');
		expect(weeks[1][0]!.day).toBe('2026-10-11');
		expect(weeks[1][3]!.day).toBe(today);
	});

	it('leaves days after today empty', () => {
		const last = calendar(new Map(), today, 1)[0];
		expect(last.slice(0, 4).every((cell) => cell !== null)).toBe(true);
		expect(last.slice(4)).toEqual([null, null, null]);
	});

	it('carries each day count and its shading', () => {
		const weeks = calendar(new Map([['2026-10-12', 12]]), today, 1);
		expect(weeks[0][1]).toEqual({ day: '2026-10-12', count: 12, level: 3 });
		expect(weeks[0][2]).toEqual({ day: '2026-10-13', count: 0, level: 0 });
	});

	it('is a full grid of seven rows per week', () => {
		for (const week of calendar(new Map(), '2026-10-17', 12)) expect(week).toHaveLength(7);
		expect(calendar(new Map(), '2026-10-17', 12)[11][6]!.day).toBe('2026-10-17');
	});
});

describe('topicStats', () => {
	const decks = [
		deck('alpha', [
			{ id: 'a1', tags: ['hash-map'] },
			{ id: 'a2', tags: ['hash-map', 'sorting'] },
			{ id: 'a3', tags: ['sorting'] }
		]),
		deck('beta', [{ id: 'b1' }])
	];

	it('counts questions, progress, and first-try accuracy per topic, and sorts the topics', () => {
		const attempts = [
			attempt('alpha', 'a1', '2026-10-10'),
			attempt('alpha', 'a1', '2026-10-11'),
			attempt('alpha', 'a2', '2026-10-10', 'again'),
			attempt('alpha', 'a2', '2026-10-10'),
			attempt('beta', 'b1', '2026-10-10')
		];
		expect(topicStats(decks, attempts)).toEqual([
			{ tag: 'hash-map', questions: 2, seen: 2, learned: 1, answered: 3, correct: 2 },
			{ tag: 'sorting', questions: 2, seen: 1, learned: 0, answered: 1, correct: 0 }
		]);
	});

	it('lists topics with nothing answered yet', () => {
		expect(topicStats(decks, []).map((stat) => [stat.tag, stat.seen, stat.answered])).toEqual([
			['hash-map', 0, 0],
			['sorting', 0, 0]
		]);
	});

	it('ignores attempts at questions that no longer exist', () => {
		expect(topicStats(decks, [attempt('gone', 'x', '2026-10-10')])[0].answered).toBe(0);
	});
});
