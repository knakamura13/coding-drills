import { describe, expect, it } from 'vitest';
import type { Attempt } from '$lib/storage/types';
import { addDays } from './days';
import { MAX_INTERVAL_DAYS, cardKey, daysUntilNextDue, dueCards, gradeOf, replay, review } from './srs';

let n = 0;
/** An attempt on `day` with a unique id, in the order created. */
function attempt(day: string, result: 'good' | 'hard' | 'again', over: Partial<Attempt> = {}): Attempt {
	n += 1;
	const base = {
		id: `id${String(n).padStart(6, '0')}`,
		at: `${day}T12:00:00.${String(n % 1000).padStart(3, '0')}Z`,
		day,
		deckId: 'deck',
		questionId: 'q1',
		pickedId: 'a'
	};
	if (result === 'good') return { ...base, correct: true, ...over };
	return { ...base, correct: false, followUp: { pickedId: 'f', correct: result === 'hard' }, ...over };
}

const card = (attempts: Attempt[], questionId = 'q1') => replay(attempts).get(cardKey('deck', questionId))!;

describe('gradeOf', () => {
	it('grades by outcome only', () => {
		expect(gradeOf({ correct: true })).toBe('good');
		expect(gradeOf({ correct: false, followUp: { pickedId: 'x', correct: true } })).toBe('hard');
		expect(gradeOf({ correct: false, followUp: { pickedId: 'x', correct: false } })).toBe('again');
		expect(gradeOf({ correct: false })).toBe('again');
	});
});

describe('review', () => {
	const ids = { deckId: 'deck', questionId: 'q1' };

	it('schedules a first good answer for tomorrow, then 3 days, then by ease', () => {
		const one = review(undefined, 'good', '2026-10-10', ids);
		expect([one.interval, one.due, one.reps]).toEqual([1, '2026-10-11', 1]);
		const two = review(one, 'good', '2026-10-11', ids);
		expect([two.interval, two.due, two.reps]).toEqual([3, '2026-10-14', 2]);
		const three = review(two, 'good', '2026-10-14', ids);
		expect(three.interval).toBe(8);
		expect(three.due).toBe('2026-10-22');
		expect(three.ease).toBe(2.5);
	});

	it('makes a hard answer grow slowly and lowers ease', () => {
		const first = review(undefined, 'hard', '2026-10-10', ids);
		expect([first.interval, first.ease]).toEqual([1, 2.35]);
		const grown = review({ ...first, interval: 10, reps: 3 }, 'hard', '2026-10-20', ids);
		expect(grown.interval).toBe(12);
		expect(grown.ease).toBeCloseTo(2.2, 5);
	});

	it('sends a failed question back to tomorrow and counts the lapse', () => {
		const learned = { ...review(undefined, 'good', '2026-10-10', ids), interval: 20, reps: 4 };
		const lapsed = review(learned, 'again', '2026-11-01', ids);
		expect([lapsed.interval, lapsed.reps, lapsed.lapses, lapsed.due]).toEqual([1, 0, 1, '2026-11-02']);
		expect(lapsed.ease).toBe(2.3);
		// After a lapse the ladder starts again: tomorrow, then 3 days.
		expect(review(lapsed, 'good', '2026-11-02', ids).interval).toBe(1);
	});

	it('never lets ease fall below its floor', () => {
		let state = review(undefined, 'again', '2026-10-01', ids);
		for (let i = 0; i < 20; i++) state = review(state, 'again', '2026-10-01', ids);
		expect(state.ease).toBe(1.3);
	});

	it('caps the interval at a year, however well it goes', () => {
		let state = review(undefined, 'good', '2026-01-01', ids);
		let day = '2026-01-01';
		for (let i = 0; i < 40; i++) {
			day = state.due;
			state = review(state, 'good', day, ids);
		}
		expect(state.interval).toBe(MAX_INTERVAL_DAYS);
	});
});

describe('replay', () => {
	it('starts nothing for a question that was never attempted', () => {
		expect(replay([]).size).toBe(0);
	});

	it('walks the ladder one attempt at a time', () => {
		const state = card([attempt('2026-10-10', 'good'), attempt('2026-10-11', 'good'), attempt('2026-10-14', 'good')]);
		expect([state.interval, state.due, state.last]).toEqual([8, '2026-10-22', '2026-10-14']);
	});

	it('counts only the first attempt of a question on a given day', () => {
		const wrongThenRight = card([attempt('2026-10-10', 'again'), attempt('2026-10-10', 'good')]);
		expect([wrongThenRight.lapses, wrongThenRight.reps, wrongThenRight.due]).toEqual([1, 0, '2026-10-11']);

		const rightThenWrong = card([attempt('2026-10-10', 'good'), attempt('2026-10-10', 'again')]);
		expect([rightThenWrong.lapses, rightThenWrong.reps, rightThenWrong.due]).toEqual([0, 1, '2026-10-11']);
	});

	it('counts the same question again on the next day, and keeps questions apart', () => {
		const cards = replay([
			attempt('2026-10-10', 'good'),
			attempt('2026-10-10', 'again', { questionId: 'q2' }),
			attempt('2026-10-11', 'good'),
			attempt('2026-10-10', 'good', { deckId: 'other' })
		]);
		expect(cards.get(cardKey('deck', 'q1'))!.reps).toBe(2);
		expect(cards.get(cardKey('deck', 'q2'))!.lapses).toBe(1);
		expect(cards.get(cardKey('other', 'q1'))!.reps).toBe(1);
	});

	it('gives every device the same schedule once they hold the same attempts', () => {
		const history = [
			attempt('2026-10-10', 'again'),
			attempt('2026-10-11', 'hard'),
			attempt('2026-10-13', 'good'),
			attempt('2026-10-20', 'good'),
			attempt('2026-10-10', 'good', { questionId: 'q2' }),
			attempt('2026-10-12', 'again', { questionId: 'q2' })
		];
		const order = (list: Attempt[]) => [...list].sort((a, b) => (a.at === b.at ? (a.id < b.id ? -1 : 1) : a.at < b.at ? -1 : 1));
		const forward = replay(order(history));
		const backward = replay(order([...history].reverse()));
		expect([...backward.entries()]).toEqual([...forward.entries()]);
	});
});

describe('dueCards and daysUntilNextDue', () => {
	const cards = [...replay([
		attempt('2026-10-01', 'good', { questionId: 'old' }),
		attempt('2026-10-05', 'good', { questionId: 'newer' }),
		attempt('2026-10-09', 'good', { questionId: 'fresh' })
	]).values()];

	it('lists what is due, most overdue first', () => {
		expect(dueCards(cards, '2026-10-10').map((c) => c.questionId)).toEqual(['old', 'newer', 'fresh']);
		expect(dueCards(cards, '2026-10-06').map((c) => c.questionId)).toEqual(['old', 'newer']);
		expect(dueCards(cards, '2026-10-01')).toEqual([]);
	});

	it('breaks ties by key so the order never changes between renders', () => {
		const tied = [...replay([attempt('2026-10-01', 'good', { questionId: 'b' }), attempt('2026-10-01', 'good', { questionId: 'a' })]).values()];
		expect(dueCards(tied, '2026-10-02').map((c) => c.questionId)).toEqual(['a', 'b']);
	});

	it('counts the days until the next card is due', () => {
		expect(daysUntilNextDue(cards, '2026-09-30')).toBe(2);
		expect(daysUntilNextDue(cards, '2026-10-10')).toBe(0);
		expect(daysUntilNextDue([], '2026-10-10')).toBeNull();
		expect(addDays('2026-10-01', 1)).toBe('2026-10-02');
	});
});
