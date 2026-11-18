import { describe, expect, it } from 'vitest';
import type { Curriculum, CurriculumDrill, Disposition } from '$lib/content/curriculum';
import type { Attempt } from '$lib/storage/types';
import { dispositionLabel, examDrillPassed, examGate, pairInOrder, projectCurriculum, rollup, skillState } from './mastery.ts';

function attempt(questionId: string, correct: boolean, day = '2026-01-01', id = questionId): Attempt {
	return {
		id,
		at: `${day}T12:00:00.000Z`,
		day,
		deckId: 'deck',
		questionId,
		pickedId: correct ? 'yes' : 'no',
		correct
	};
}

describe('examGate', () => {
	const requires = ['alpha', 'beta', 'gamma'];

	it('stays locked while any required skill is unmastered and names those skills in order', () => {
		expect(examGate(requires, new Set(), false)).toEqual({ state: 'locked', remaining: requires });
		expect(examGate(requires, new Set(['alpha', 'gamma']), false)).toEqual({ state: 'locked', remaining: ['beta'] });
	});

	it('unlocks as soon as the last required skill is mastered', () => {
		expect(examGate(requires, new Set(requires), false)).toEqual({ state: 'available', remaining: [] });
	});

	it('ignores skills that do not lead into the exam', () => {
		expect(examGate(requires, new Set(['other']), false).remaining).toEqual(requires);
	});

	it('reports passed only after the gate is open', () => {
		expect(examGate(requires, new Set(['alpha']), true)).toEqual({ state: 'locked', remaining: ['beta', 'gamma'] });
		expect(examGate(requires, new Set(requires), true)).toEqual({ state: 'passed', remaining: [] });
	});

	it('is available when nothing is required and the exam was not passed', () => {
		expect(examGate([], new Set(), false)).toEqual({ state: 'available', remaining: [] });
	});
});

describe('placeholder skill state', () => {
	it('pairs teaching drills in order and piles extras on the last skill', () => {
		const paired = pairInOrder(['one', 'two'], ['a', 'b', 'c']);
		expect(paired.get('one')).toEqual(['a']);
		expect(paired.get('two')).toEqual(['b', 'c']);
		expect([...pairInOrder([], ['a']).keys()]).toEqual([]);
	});

	it('stays not started with no drills or no attempts', () => {
		expect(skillState([], [attempt('q', true)])).toBe('unexplored');
		expect(skillState([{ deckId: 'deck', questionId: 'q' }], [])).toBe('unexplored');
	});

	it('is practicing after a miss, and mastered only when every paired drill was right first', () => {
		const drills = [
			{ deckId: 'deck', questionId: 'a' },
			{ deckId: 'deck', questionId: 'b' }
		];
		expect(skillState(drills, [attempt('a', false)])).toBe('practicing');
		expect(skillState(drills, [attempt('a', true)])).toBe('practicing');
		expect(skillState(drills, [attempt('a', true), attempt('b', true, '2026-01-02', 'b')])).toBe('mastered');
	});

	it('does not treat a same-day retake as the counted attempt', () => {
		const drills = [{ deckId: 'deck', questionId: 'a' }];
		const wrong = attempt('a', false, '2026-01-01', 'first');
		const retake = attempt('a', true, '2026-01-01', 'second');
		expect(skillState(drills, [wrong, retake])).toBe('practicing');
		expect(skillState(drills, [wrong, attempt('a', true, '2026-01-02', 'next')])).toBe('mastered');
	});

	it('counts an exam drill as passed only from a counted correct attempt', () => {
		const drills = [{ deckId: 'deck', questionId: 'exam' }];
		expect(examDrillPassed([], [])).toBe(false);
		expect(examDrillPassed(drills, [attempt('exam', false)])).toBe(false);
		expect(examDrillPassed(drills, [attempt('exam', true)])).toBe(true);
	});
});

describe('labels', () => {
	it('names each disposition', () => {
		const names: Disposition[] = ['keep', 'rewrite', 'exam', 'retire'];
		expect(names.map(dispositionLabel)).toEqual(['Keep', 'Rewrite', 'Exam', 'Retire']);
	});
});

describe('rollup', () => {
	it('is mastered only when every skill is, and practicing when any has started', () => {
		expect(rollup([])).toBe('unexplored');
		expect(rollup(['unexplored', 'unexplored'])).toBe('unexplored');
		expect(rollup(['mastered', 'unexplored'])).toBe('practicing');
		expect(rollup(['mastered', 'mastered'])).toBe('mastered');
	});
});

function drill(questionId: string, pathId: string, disposition: CurriculumDrill['disposition']): CurriculumDrill {
	return { questionId, deckId: 'deck', disposition, pathId, note: 'Noted.' };
}

function tree(): Curriculum {
	return {
		branches: [
			{
				id: 'one',
				title: 'One',
				summary: 'First.',
				order: 1,
				paths: [
					{
						id: 'alpha',
						title: 'Alpha',
						summary: 'Start.',
						branchId: 'one',
						after: [],
						skills: [
							{ kind: 'skill', id: 'a1', title: 'First', pathId: 'alpha', branchId: 'one', line: 'main', after: [] },
							{ kind: 'skill', id: 'a2', title: 'Second', pathId: 'alpha', branchId: 'one', line: 'main', after: ['a1'] }
						],
						forks: [],
						checkpoints: [
							{
								kind: 'checkpoint',
								id: 'alpha-exam',
								title: 'Alpha exam',
								summary: 'Both.',
								pathId: 'alpha',
								branchId: 'one',
								requires: ['a1', 'a2']
							}
						]
					}
				]
			},
			{
				id: 'two',
				title: 'Two',
				summary: 'Second.',
				order: 2,
				paths: [
					{
						id: 'beta',
						title: 'Beta',
						summary: 'Joins.',
						branchId: 'two',
						after: ['alpha'],
						afterNote: 'Alpha leads in.',
						skills: [
							{ kind: 'skill', id: 'b1', title: 'Beta skill', pathId: 'beta', branchId: 'two', line: 'main', after: ['a2'] },
							{
								kind: 'skill',
								id: 'b-fork',
								title: 'Fork skill',
								pathId: 'beta',
								branchId: 'two',
								line: 'side',
								after: ['a2']
							}
						],
						forks: [{ id: 'side', title: 'Side', after: null, skillIds: ['b-fork'] }],
						checkpoints: [
							{
								kind: 'checkpoint',
								id: 'beta-exam',
								title: 'Beta exam',
								summary: 'Waits on both branches.',
								pathId: 'beta',
								branchId: 'two',
								requires: ['b1', 'b-fork', 'a1', 'a2']
							}
						]
					}
				]
			}
		],
		drills: [
			drill('a1q', 'alpha', 'keep'),
			drill('a2q', 'alpha', 'rewrite'),
			drill('alpha-exam-q', 'alpha', 'exam'),
			drill('retired', 'alpha', 'retire'),
			drill('b1q', 'beta', 'keep'),
			drill('forkq', 'beta', 'keep'),
			drill('beta-exam-q', 'beta', 'exam')
		],
		followUps: []
	};
}

describe('projectCurriculum', () => {
	const curriculum = tree();

	it('locks a converging exam while one incoming skill is unmastered, then unlocks it', () => {
		const almost = [
			attempt('a1q', true),
			attempt('a2q', true, '2026-01-02', 'a2'),
			attempt('b1q', true, '2026-01-03', 'b1')
		];
		const locked = projectCurriculum(curriculum, almost);
		const beta = locked.branches[1]!.paths[0]!;
		expect(beta.checkpoints[0]).toMatchObject({ state: 'locked', lit: false });
		expect(beta.checkpoints[0]!.remaining.map((skill) => skill.id)).toEqual(['b-fork']);
		expect(beta.after[0]).toMatchObject({ id: 'alpha', cross: true, mastered: true });

		const open = projectCurriculum(curriculum, [...almost, attempt('forkq', true, '2026-01-04', 'fork')]);
		expect(open.branches[1]!.paths[0]!.checkpoints[0]!.state).toBe('available');
		expect(open.branches[1]!.paths[0]!.main[0]).toMatchObject({ state: 'mastered', lit: true });
	});

	it('does not mark the exam passed until its own drill is correct and the gate is open', () => {
		const skills = ['a1q', 'a2q', 'b1q', 'forkq'].map((id, index) =>
			attempt(id, true, `2026-01-0${index + 1}`, id)
		);
		expect(projectCurriculum(curriculum, skills).branches[1]!.paths[0]!.checkpoints[0]!.state).toBe('available');
		const passed = projectCurriculum(curriculum, [...skills, attempt('beta-exam-q', true, '2026-01-08', 'exam')]);
		expect(passed.branches[1]!.paths[0]!.checkpoints[0]!.state).toBe('passed');
		const early = projectCurriculum(curriculum, [attempt('beta-exam-q', true)]);
		expect(early.branches[1]!.paths[0]!.checkpoints[0]!.state).toBe('locked');
	});

	it('ignores retired drills and leaves an unexplored root unlit', () => {
		const view = projectCurriculum(curriculum, [attempt('retired', true)]);
		expect(view.branches[0]!.paths[0]!.main[0]!.state).toBe('unexplored');
		expect(view.branches[0]!.paths[0]!.main[0]!.lit).toBe(false);
		expect(view.state).toBe('unexplored');
	});

	it('lights the next skill only after the previous one is mastered', () => {
		const started = projectCurriculum(curriculum, [attempt('a1q', false)]);
		expect(started.branches[0]!.paths[0]!.main[0]).toMatchObject({ state: 'practicing', lit: true });
		expect(started.branches[0]!.paths[0]!.main[1]!.lit).toBe(false);
		const done = projectCurriculum(curriculum, [attempt('a1q', true)]);
		expect(done.branches[0]!.paths[0]!.main[1]!.lit).toBe(true);
	});
});
