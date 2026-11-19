import { describe, expect, it } from 'vitest';
import type { CurriculumDrill } from '$lib/content/curriculum';
import { EXAM_RULES_VERSION, type Attempt } from '$lib/storage/types';
import { curriculum } from 'virtual:curriculum';
import { examDrills, projectCurriculum } from './mastery';
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

	it('keeps an old Count islands pass and requires the full sitting for new attempts', () => {
		const paths = curriculum.branches.flatMap((branch) => branch.paths);
		const path = paths.find((entry) => entry.id === 'reachability')!;
		const checkpoint = path.checkpoints[0];
		const drills = examDrills(path, curriculum.drills).get(checkpoint.id)!;
		const legacy = { ...attempt('count-islands', true), deckId: 'graph-traversal-grids' };
		const current = { ...legacy, examRulesVersion: EXAM_RULES_VERSION };
		expect(drills).toHaveLength(5);
		expect(examPassed(drills, checkpoint.mix, [legacy])).toBe(true);
		expect(examPassed(drills, checkpoint.mix, [{ ...legacy, correct: false }])).toBe(false);
		expect(examPassed(drills, checkpoint.mix, [{ ...legacy, examRulesVersion: 2 }])).toBe(false);
		expect(examPassed(drills, checkpoint.mix, [current])).toBe(false);

		const sitting = drills.map((drill) => ({
			...attempt(drill.questionId, true), deckId: drill.deckId, examRulesVersion: EXAM_RULES_VERSION
		}));
		expect(examPassed(drills, checkpoint.mix, sitting)).toBe(true);

		const projected = (events: Attempt[]) => projectCurriculum(curriculum, events).branches.flatMap((branch) => branch.paths);
		const view = projected([legacy]);
		expect(view.find((entry) => entry.id === 'reachability')?.checkpoints[0].state).toBe('passed');
		expect(view.find((entry) => entry.id === 'traversal-layers')?.main[0].lockedBy).toEqual([]);
		expect(projected([current]).find((entry) => entry.id === 'traversal-layers')?.main[0].lockedBy)
			.toContainEqual({ id: 'reachability', title: 'Reachability' });
	});

	it('carries forward prior simultaneous-spread passes, including version 2', () => {
		const path = curriculum.branches.flatMap((branch) => branch.paths).find((entry) => entry.id === 'traversal-layers')!;
		const checkpoint = path.checkpoints[0];
		const drills = examDrills(path, curriculum.drills).get(checkpoint.id)!;
		const original = { ...attempt('multi-source-bfs', true), deckId: 'graph-traversal-grids' };
		expect(drills).toHaveLength(5);
		expect(examPassed(drills, checkpoint.mix, [original])).toBe(true);
		expect(examPassed(drills, checkpoint.mix, [{ ...original, examRulesVersion: 2 }])).toBe(true);
		expect(examPassed(drills, checkpoint.mix, [{ ...original, examRulesVersion: EXAM_RULES_VERSION }])).toBe(false);
		const sitting = drills.map((drill) => ({
			...attempt(drill.questionId, true), deckId: drill.deckId, examRulesVersion: EXAM_RULES_VERSION
		}));
		expect(examPassed(drills, checkpoint.mix, sitting)).toBe(true);
	});

	it('carries forward prior partial-Kahn-result passes, including version 3', () => {
		const path = curriculum.branches.flatMap((branch) => branch.paths).find((entry) => entry.id === 'dependency-order')!;
		const checkpoint = path.checkpoints[0];
		const drills = examDrills(path, curriculum.drills).get(checkpoint.id)!;
		const original = { ...attempt('kahn-short-result', true), deckId: 'graph-algorithms' };
		expect(drills).toHaveLength(5);
		expect(examPassed(drills, checkpoint.mix, [original])).toBe(true);
		expect(examPassed(drills, checkpoint.mix, [{ ...original, examRulesVersion: 3 }])).toBe(true);
		expect(examPassed(drills, checkpoint.mix, [{ ...original, examRulesVersion: EXAM_RULES_VERSION }])).toBe(false);
		const sitting = drills.map((drill) => ({
			...attempt(drill.questionId, true), deckId: drill.deckId, examRulesVersion: EXAM_RULES_VERSION
		}));
		expect(examPassed(drills, checkpoint.mix, sitting)).toBe(true);
	});

	it('carries forward prior connectivity passes, including version 3', () => {
		const path = curriculum.branches.flatMap((branch) => branch.paths).find((entry) => entry.id === 'connectivity')!;
		const checkpoint = path.checkpoints[0];
		const drills = examDrills(path, curriculum.drills).get(checkpoint.id)!;
		const original = { ...attempt('count-components-edge-list', true), deckId: 'graph-algorithms' };
		expect(drills).toHaveLength(5);
		expect(examPassed(drills, checkpoint.mix, [original])).toBe(true);
		expect(examPassed(drills, checkpoint.mix, [{ ...original, examRulesVersion: 3 }])).toBe(true);
		expect(examPassed(drills, checkpoint.mix, [{ ...original, examRulesVersion: EXAM_RULES_VERSION }])).toBe(false);
		const sitting = drills.map((drill) => ({
			...attempt(drill.questionId, true), deckId: drill.deckId, examRulesVersion: EXAM_RULES_VERSION
		}));
		expect(examPassed(drills, checkpoint.mix, sitting)).toBe(true);
	});

	it('carries forward prior traversal-and-depth passes, including version 3', () => {
		const path = curriculum.branches.flatMap((branch) => branch.paths).find((entry) => entry.id === 'tree-walks')!;
		const checkpoint = path.checkpoints[0];
		const drills = examDrills(path, curriculum.drills).get(checkpoint.id)!;
		const original = { ...attempt('recursion-cost', true), deckId: 'trees-traversals-bst' };
		expect(drills).toHaveLength(5);
		expect(examPassed(drills, checkpoint.mix, [original])).toBe(true);
		expect(examPassed(drills, checkpoint.mix, [{ ...original, examRulesVersion: 3 }])).toBe(true);
		expect(examPassed(drills, checkpoint.mix, [{ ...original, examRulesVersion: EXAM_RULES_VERSION }])).toBe(false);
		const sitting = drills.map((drill) => ({
			...attempt(drill.questionId, true), deckId: drill.deckId, examRulesVersion: EXAM_RULES_VERSION
		}));
		expect(examPassed(drills, checkpoint.mix, sitting)).toBe(true);
	});

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
