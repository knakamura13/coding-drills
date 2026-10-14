import { describe, expect, it } from 'vitest';
import type { Deck } from '$lib/content/schema';
import type { Attempt } from '$lib/storage/types';
import { REVIEW_SIZE, deckProgress, reviewStatus, scheduleCounts } from './queue';

function deck(id: string, questionIds: string[], heading?: string): Deck {
	return {
		id,
		title: id,
		description: 'd',
		heading,
		questions: questionIds.map((qid) => ({
			id: qid,
			prompt: 'p',
			options: [
				{ id: 'right', text: 'Right', explanation: 'e' },
				{ id: 'wrong', text: 'Wrong', explanation: 'e' }
			],
			correct: 'right',
			followUps: {
				wrong: {
					prompt: 'f',
					options: [
						{ id: 'x', text: 'X' },
						{ id: 'y', text: 'Y' }
					],
					correct: 'x',
					explanation: 'e'
				}
			}
		}))
	};
}

let n = 0;
function attempt(deckId: string, questionId: string, day: string, correct = true): Attempt {
	n += 1;
	return {
		id: `id${String(n).padStart(6, '0')}`,
		at: `${day}T12:00:00.000Z`,
		day,
		deckId,
		questionId,
		pickedId: correct ? 'right' : 'wrong',
		correct,
		...(correct ? {} : { followUp: { pickedId: 'y', correct: false } })
	};
}

describe('reviewStatus', () => {
	const decks = [deck('alpha', ['a1', 'a2']), deck('beta', ['b1'])];

	it('has nothing scheduled before any attempt', () => {
		expect(reviewStatus(decks, [], '2026-10-10')).toEqual({ dueCount: 0, entries: [], nextInDays: null });
	});

	it('is not due on the day of the attempt, and says when the next one is', () => {
		const status = reviewStatus(decks, [attempt('alpha', 'a1', '2026-10-10')], '2026-10-10');
		expect(status).toMatchObject({ dueCount: 0, entries: [], nextInDays: 1 });
	});

	it('collects due questions from every deck, most overdue first', () => {
		const attempts = [
			attempt('beta', 'b1', '2026-10-05'),
			attempt('alpha', 'a1', '2026-10-01'),
			attempt('alpha', 'a2', '2026-10-09')
		];
		const status = reviewStatus(decks, attempts, '2026-10-10');
		expect(status.dueCount).toBe(3);
		expect(status.entries.map((e) => `${e.deckId}/${e.question.id}`)).toEqual(['alpha/a1', 'beta/b1', 'alpha/a2']);
		expect(status.nextInDays).toBe(0);
	});

	it('brings back a missed question the next day', () => {
		const status = reviewStatus(decks, [attempt('alpha', 'a1', '2026-10-10', false)], '2026-10-11');
		expect(status.entries.map((e) => e.question.id)).toEqual(['a1']);
	});

	it('limits a sitting to the most overdue, but reports the full count', () => {
		const many = deck('many', Array.from({ length: 14 }, (_, i) => `m${String(i).padStart(2, '0')}`));
		const attempts = many.questions.map((q, i) => attempt('many', q.id, `2026-09-${String(i + 1).padStart(2, '0')}`));
		const status = reviewStatus([many], attempts, '2026-10-10');
		expect(status.dueCount).toBe(14);
		expect(status.entries).toHaveLength(REVIEW_SIZE);
		expect(status.entries[0].question.id).toBe('m00');
	});

	it('skips questions whose deck or id no longer exists', () => {
		const attempts = [attempt('gone', 'x', '2026-10-01'), attempt('alpha', 'removed', '2026-10-01'), attempt('alpha', 'a1', '2026-10-01')];
		const status = reviewStatus(decks, attempts, '2026-10-10');
		expect(status.entries.map((e) => e.question.id)).toEqual(['a1']);
		expect(status.dueCount).toBe(1);
	});
});

describe('deckProgress', () => {
	const decks = [deck('alpha', ['a1', 'a2', 'a3']), deck('beta', ['b1'])];

	it('counts seen, learned, and due per deck', () => {
		const attempts = [
			// a1: good twice, so it is scheduled 3 days out: learned, not due on the 12th.
			attempt('alpha', 'a1', '2026-10-10'),
			attempt('alpha', 'a1', '2026-10-11'),
			// a2: answered once, due the next day.
			attempt('alpha', 'a2', '2026-10-11')
		];
		const progress = deckProgress(decks, attempts, '2026-10-12');
		expect(progress.get('alpha')).toEqual({ seen: 2, learned: 1, due: 1 });
		expect(progress.get('beta')).toEqual({ seen: 0, learned: 0, due: 0 });
	});
});

describe('scheduleCounts', () => {
	const decks = [deck('alpha', ['a1', 'a2']), deck('beta', ['b1'])];

	it('agrees with reviewStatus on what is due and when the next question is', () => {
		const attempts = [
			attempt('beta', 'b1', '2026-10-05'),
			attempt('alpha', 'a1', '2026-10-01'),
			attempt('alpha', 'a2', '2026-10-09')
		];
		for (const today of ['2026-10-03', '2026-10-10']) {
			const full = reviewStatus(decks, attempts, today);
			expect(scheduleCounts(decks, attempts, today)).toEqual({ dueCount: full.dueCount, nextInDays: full.nextInDays });
		}
	});

	it('ignores attempts on questions that no longer exist', () => {
		expect(scheduleCounts(decks, [attempt('gone', 'x', '2026-10-01')], '2026-10-10')).toEqual({
			dueCount: 0,
			nextInDays: null
		});
	});
});
