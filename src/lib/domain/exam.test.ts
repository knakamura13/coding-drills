import { describe, expect, it } from 'vitest';
import type { CurriculumDrill } from '$lib/content/curriculum';
import type { Attempt } from '$lib/storage/types';
import { EXAM_SIZE, drawExam, examPassed, orderForReview } from './exam';
import { seededRng } from './shuffle';

function drill(questionId: string, covers: string[] = []): CurriculumDrill {
	return { questionId, deckId: 'deck', disposition: 'exam', pathId: 'path', covers, note: 'Exam.' };
}

function attempt(questionId: string, correct: boolean, day = '2026-02-01', id = `${questionId}@${day}`): Attempt {
	return { id, at: `${day}T12:00:00.000Z`, day, deckId: 'deck', questionId, pickedId: correct ? 'yes' : 'no', correct };
}

const POOL = [drill('pairs-a', ['pairs']), drill('pairs-b', ['pairs']), drill('edit-a', ['edit']), drill('edit-b', ['edit']), drill('both', ['pairs', 'edit']), drill('plain')];

describe('drawExam', () => {
	it('draws the sitting size and never repeats an item', () => {
		const sitting = drawExam(POOL, [], EXAM_SIZE, seededRng(1));
		expect(sitting).toHaveLength(EXAM_SIZE);
		expect(new Set(sitting).size).toBe(EXAM_SIZE);
	});

	it('always includes an item for every kind in the mix, whatever the shuffle', () => {
		for (let seed = 1; seed <= 100; seed++) {
			const sitting = drawExam(POOL, ['pairs', 'edit'], 2, seededRng(seed));
			const kinds = new Set(sitting.flatMap((item) => item.covers));
			expect(kinds.has('pairs'), `seed ${seed}`).toBe(true);
			expect(kinds.has('edit'), `seed ${seed}`).toBe(true);
		}
	});

	it('takes the whole pool when it is smaller than a sitting, and grows past the size only for the mix', () => {
		expect(drawExam([drill('only')], [], EXAM_SIZE, seededRng(3))).toHaveLength(1);
		const split = [drill('a', ['x']), drill('b', ['y']), drill('c', ['z'])];
		expect(drawExam(split, ['x', 'y', 'z'], 2, seededRng(3))).toHaveLength(3);
	});

	it('is the same sitting for the same seed', () => {
		const ids = (seed: number) => drawExam(POOL, ['pairs', 'edit'], EXAM_SIZE, seededRng(seed)).map((item) => item.questionId);
		expect(ids(7)).toEqual(ids(7));
	});
});

describe('examPassed', () => {
	const pool = [drill('a', ['pairs']), drill('b', ['edit']), drill('c', ['edit']), drill('d', ['pairs']), drill('e', ['edit'])];
	const mix = ['pairs', 'edit'];

	it('passes a full sitting with one first-try miss and the mix answered right', () => {
		const sitting = [attempt('a', true), attempt('b', true), attempt('c', false), attempt('d', true), attempt('e', true)];
		expect(examPassed(pool, mix, sitting)).toBe(true);
	});

	it('fails with two misses, a short sitting, or a missing kind', () => {
		expect(examPassed(pool, mix, [attempt('a', true), attempt('b', false), attempt('c', false), attempt('d', true), attempt('e', true)])).toBe(false);
		expect(examPassed(pool, mix, [attempt('a', true), attempt('b', true), attempt('c', true), attempt('d', true)])).toBe(false);
		// Only `a` covers pairs here. One miss is allowed, but a miss on that item leaves the kind unanswered.
		const oneOfAKind = [drill('a', ['pairs']), drill('b', ['edit']), drill('c', ['edit']), drill('d', ['edit']), drill('e', ['edit'])];
		const missedKind = [attempt('a', false), attempt('b', true), attempt('c', true), attempt('d', true), attempt('e', true)];
		expect(examPassed(oneOfAKind, mix, missedKind)).toBe(false);
		expect(examPassed(oneOfAKind, mix, [attempt('a', true), ...missedKind.slice(1)])).toBe(true);
	});

	it('counts a sitting on one day, not answers spread across days or a same-day retake', () => {
		const spread = [attempt('a', true, '2026-02-01'), attempt('b', true, '2026-02-02'), attempt('c', true, '2026-02-03'), attempt('d', true, '2026-02-04'), attempt('e', true, '2026-02-05')];
		expect(examPassed(pool, mix, spread)).toBe(false);
		const retake = [
			attempt('a', false, '2026-02-01', 'a1'),
			attempt('a', true, '2026-02-01', 'a2'),
			attempt('b', false, '2026-02-01', 'b1'),
			attempt('b', true, '2026-02-01', 'b2'),
			attempt('c', true),
			attempt('d', true),
			attempt('e', true)
		];
		expect(examPassed(pool, mix, retake)).toBe(false);
	});

	it('lets a later day pass after an earlier failed sitting', () => {
		const failed = ['a', 'b', 'c', 'd', 'e'].map((id) => attempt(id, false, '2026-02-01'));
		const retake = ['a', 'b', 'c', 'd', 'e'].map((id) => attempt(id, true, '2026-02-02'));
		expect(examPassed(pool, mix, [...failed, ...retake])).toBe(true);
	});

	it('needs no misses from a one-item pool, and ignores answers to other questions', () => {
		const single = [drill('only')];
		expect(examPassed(single, [], [attempt('only', true)])).toBe(true);
		expect(examPassed(single, [], [attempt('only', false)])).toBe(false);
		expect(examPassed(single, [], [attempt('other', true)])).toBe(false);
		expect(examPassed([], [], [attempt('only', true)])).toBe(false);
	});
});

describe('orderForReview', () => {
	const drills = [drill('missed'), drill('unseen'), drill('old-right'), drill('new-right'), drill('also-missed')];

	it('puts misses first, then drills never answered, then the longest-ago right answers', () => {
		const log = [
			attempt('old-right', true, '2026-02-01'),
			attempt('new-right', true, '2026-02-09'),
			attempt('missed', false, '2026-02-08'),
			attempt('also-missed', false, '2026-02-03')
		];
		expect(orderForReview(drills, log).map((item) => item.questionId)).toEqual(['also-missed', 'missed', 'unseen', 'old-right', 'new-right']);
	});

	it('uses the latest counted attempt, so a later right answer retires an old miss', () => {
		const log = [attempt('missed', false, '2026-02-01'), attempt('missed', true, '2026-02-05')];
		expect(orderForReview([drill('missed'), drill('unseen')], log).map((item) => item.questionId)).toEqual(['unseen', 'missed']);
	});

	it('is stable for equal ranks', () => {
		expect(orderForReview([drill('a'), drill('b'), drill('c')], []).map((item) => item.questionId)).toEqual(['a', 'b', 'c']);
	});
});
