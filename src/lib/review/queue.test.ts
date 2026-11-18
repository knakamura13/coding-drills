import { describe, expect, it } from 'vitest';
import type { CurriculumDrill } from '$lib/content/curriculum';
import { advance, check, createReviewLesson, select } from '$lib/domain/lesson';
import { teachingBySkill } from '$lib/domain/mastery';
import { curriculum } from 'virtual:curriculum';
import { decks as publishedDecks } from 'virtual:decks';
import { replay } from '$lib/domain/srs';
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

describe('reviewStatus limited to some questions', () => {
	const decks = [deck('d', ['a', 'b', 'c'])];
	const log = [attempt('d', 'a', '2026-01-01'), attempt('d', 'b', '2026-01-01'), attempt('d', 'c', '2026-01-01')];

	it('keeps only the named cards, and counts only those as due', () => {
		const everything = reviewStatus(decks, log, '2026-02-01');
		expect(everything.dueCount).toBe(3);
		const some = reviewStatus(decks, log, '2026-02-01', undefined, new Set(['d/a', 'd/c']));
		expect(some.dueCount).toBe(2);
		expect(some.entries.map((entry) => entry.question.id).sort()).toEqual(['a', 'c']);
	});

	it('is empty when none of the named cards is due', () => {
		expect(reviewStatus(decks, log, '2026-02-01', undefined, new Set(['d/zzz'])).entries).toEqual([]);
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

describe('fresh review variants', () => {
	const decks = [deck('alpha', ['a1', 'a2', 'a3']), deck('beta', ['original', 'fresh', 'older', 'other-skill'])];
	const mapping = (deckId: string, questionId: string, skillId: string, variant?: true): CurriculumDrill => ({
		deckId, questionId, skillId, variant, disposition: 'keep', pathId: 'path', covers: [], note: 'drill'
	});
	const drills = [
		...['a1', 'a2', 'a3'].map((id) => mapping('alpha', id, 'same')),
		mapping('beta', 'original', 'same'),
		mapping('beta', 'fresh', 'same', true),
		mapping('beta', 'older', 'same', true),
		mapping('beta', 'other-skill', 'different', true)
	];

	const bySkill = new Map([
		['same', drills.filter((drill) => drill.skillId === 'same')],
		['different', drills.filter((drill) => drill.skillId === 'different')]
	]);

	it('uses the tree’s positional assignment for a legacy drill', () => {
		const path = curriculum.branches.flatMap((branch) => branch.paths).find((entry) => entry.id === 'recursive-calls')!;
		const resolved = teachingBySkill(path, curriculum.drills);
		const original = attempt('recursion-backtracking', 'base-case-depth', '2026-10-09');
		const status = reviewStatus(publishedDecks, [original], '2026-10-10', undefined, undefined, resolved);
		expect(status.entries[0]).toMatchObject({
			deckId: 'recursive-calls-review',
			reviewOf: { deckId: original.deckId, questionId: original.questionId }
		});
	});

	it('uses distinct fresh siblings without displacing due misses or using unmarked drills', () => {
		const log = [
			attempt('beta', 'older', '2026-10-07'),
			attempt('beta', 'older', '2026-10-08'),
			attempt('alpha', 'a1', '2026-10-08'),
			attempt('alpha', 'a2', '2026-10-09'),
			attempt('alpha', 'a3', '2026-10-09', false)
		];
		const status = reviewStatus(decks, log, '2026-10-10', undefined, undefined, bySkill);
		expect(status.dueCount).toBe(3);
		expect(status.entries.map((entry) => entry.question.id)).toEqual(['fresh', 'older', 'a3']);
	});

	it('reserves due siblings and advances the original card from the saved variant attempt', () => {
		const log = [
			attempt('alpha', 'a1', '2026-10-08'),
			attempt('beta', 'older', '2026-10-09', false)
		];
		const status = reviewStatus(decks, log, '2026-10-10', undefined, new Set(['alpha/a1']), bySkill);
		expect(status.entries.map((entry) => entry.question.id)).toEqual(['fresh']);
		const lesson = createReviewLesson(status.entries);
		const [completed] = advance(check(select(lesson, 'right'))).completed;
		expect(completed).toMatchObject({
			deckId: 'beta', questionId: 'fresh', reviewOf: { deckId: 'alpha', questionId: 'a1' }
		});
		const reviewed = [...log, { ...attempt('beta', 'fresh', '2026-10-10'), ...completed }];
		expect(scheduleCounts(decks, reviewed, '2026-10-10').dueCount).toBe(1);
		expect(replay(reviewed).get('alpha/a1')?.due).toBe('2026-10-13');
		expect(replay(reviewed).get('beta/fresh')?.due).toBe('2026-10-11');
	});

	it('falls back when siblings are due or have already been seen today', () => {
		const log = [
			attempt('beta', 'older', '2026-10-07', false),
			attempt('alpha', 'a1', '2026-10-08'),
			attempt('beta', 'fresh', '2026-10-10')
		];
		const status = reviewStatus(decks, log, '2026-10-10', undefined, undefined, bySkill);
		expect(status.entries.map((entry) => entry.question.id)).toEqual(['older', 'a1']);
		expect(status.entries.every((entry) => !entry.reviewOf)).toBe(true);
	});
});
