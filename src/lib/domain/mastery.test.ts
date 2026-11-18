import { describe, expect, it } from 'vitest';
import type { Curriculum, CurriculumDrill, Disposition } from '$lib/content/curriculum';
import type { Attempt } from '$lib/storage/types';
import { dispositionLabel, examGate, pairInOrder, projectCurriculum, rollup, skillState } from './mastery.ts';

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

	it('keeps a passed exam passed even when a required skill is no longer mastered', () => {
		expect(examGate(requires, new Set(['alpha']), true)).toEqual({ state: 'passed', remaining: [] });
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
});

describe('mastery decay', () => {
	const drills = [
		{ deckId: 'deck', questionId: 'a' },
		{ deckId: 'deck', questionId: 'b' }
	];
	const mastered = [attempt('a', true, '2026-01-01', 'a1'), attempt('b', true, '2026-01-01', 'b1')];

	it('drops a mastered skill back to practicing after a later miss, and restores it after a later right answer', () => {
		expect(skillState(drills, mastered)).toBe('mastered');
		const missed = [...mastered, attempt('a', false, '2026-01-05', 'a2')];
		expect(skillState(drills, missed)).toBe('practicing');
		const restored = [...missed, attempt('a', true, '2026-01-09', 'a3')];
		expect(skillState(drills, restored)).toBe('mastered');
	});

	it('goes by the latest counted attempt, not the order the log was written in', () => {
		const shuffledLog = [attempt('a', true, '2026-01-09', 'a3'), attempt('a', false, '2026-01-05', 'a2'), ...mastered];
		expect(skillState(drills, shuffledLog)).toBe('mastered');
	});

	it('does not let a same-day second attempt change the counted result', () => {
		const sameDayMiss = [...mastered, attempt('a', true, '2026-01-05', 'first'), attempt('a', false, '2026-01-05', 'second')];
		expect(skillState(drills, sameDayMiss)).toBe('mastered');
	});

	it('locks an exam that has not been passed when a skill decays, and keeps a passed one', () => {
		const curriculum = tree();
		const skills = ['a1q', 'a2q', 'b1q', 'forkq'].map((id, index) => attempt(id, true, `2026-01-0${index + 1}`, id));
		expect(projectCurriculum(curriculum, skills).branches[1]!.paths[0]!.checkpoints[0]!.state).toBe('available');
		const decayed = [...skills, attempt('b1q', false, '2026-02-01', 'late-miss')];
		expect(projectCurriculum(curriculum, decayed).branches[1]!.paths[0]!.checkpoints[0]!.state).toBe('locked');
		const passed = [...decayed, attempt('beta-exam-q', true, '2026-02-02', 'exam')];
		expect(projectCurriculum(curriculum, passed).branches[1]!.paths[0]!.checkpoints[0]!.state).toBe('passed');
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
	return { questionId, deckId: 'deck', disposition, pathId, covers: [], note: 'Noted.' };
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
								requires: ['a1', 'a2'],
								mix: []
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
								requires: ['b1', 'b-fork', 'a1', 'a2'],
								mix: []
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

	it('puts a drill on the skill it names and pairs the others by position', () => {
		const named: Curriculum = {
			...curriculum,
			drills: [
				{ ...drill('a1q', 'alpha', 'keep'), skillId: 'a2' },
				drill('a2q', 'alpha', 'keep'),
				drill('a3q', 'alpha', 'keep')
			]
		};
		const alpha = projectCurriculum(named, []).branches[0]!.paths[0]!;
		expect(alpha.main.map((skill) => skill.drills.map((item) => item.questionId))).toEqual([
			['a2q'],
			['a3q', 'a1q']
		]);
	});

	it('masters a skill from the drills it names, not from the last-skill pile', () => {
		const named: Curriculum = {
			...curriculum,
			drills: [
				{ ...drill('a1q', 'alpha', 'keep'), skillId: 'a1' },
				{ ...drill('a2q', 'alpha', 'keep'), skillId: 'a2' },
				{ ...drill('a3q', 'alpha', 'keep'), skillId: 'a2' }
			]
		};
		const alpha = projectCurriculum(named, [attempt('a1q', true)]).branches[0]!.paths[0]!;
		expect(alpha.main.map((skill) => skill.state)).toEqual(['mastered', 'unexplored']);
	});

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
		// A full sitting answered right is evidence enough, so it passes even before the skills are mastered.
		// The lock only gates the exam link in the tree.
		const early = projectCurriculum(curriculum, [attempt('beta-exam-q', true)]);
		expect(early.branches[1]!.paths[0]!.checkpoints[0]!.state).toBe('passed');
		const wrongEarly = projectCurriculum(curriculum, [attempt('beta-exam-q', false)]);
		expect(wrongEarly.branches[1]!.paths[0]!.checkpoints[0]!.state).toBe('locked');
	});

	it('locks a path\'s entrance skills until every checkpoint of the path before it is passed', () => {
		const mastered = [attempt('a1q', true), attempt('a2q', true, '2026-01-02', 'a2')];
		const beta = (attempts: Attempt[]) => projectCurriculum(curriculum, attempts).branches[1]!.paths[0]!;
		const before = beta(mastered);
		expect(before.main[0]!.lockedBy).toEqual([{ id: 'alpha', title: 'Alpha' }]);
		expect(before.after[0]).toMatchObject({ id: 'alpha', mastered: true, cleared: false });
		// Mastering the last skill is not enough. The checkpoint has to be passed.
		const passed = beta([...mastered, attempt('alpha-exam-q', true, '2026-01-03', 'ex')]);
		expect(passed.main[0]!.lockedBy).toEqual([]);
		expect(passed.after[0]).toMatchObject({ cleared: true });
	});

	it('never locks a root path, a later skill in a path, or a path that has no exam drill to sit', () => {
		const alpha = projectCurriculum(curriculum, []).branches[0]!.paths[0]!;
		expect(alpha.main.map((skill) => skill.lockedBy)).toEqual([[], []]);
		const noExam: Curriculum = { ...curriculum, drills: curriculum.drills.filter((item) => item.questionId !== 'alpha-exam-q') };
		const beta = projectCurriculum(noExam, []).branches[1]!.paths[0]!;
		expect(beta.main[0]!.lockedBy).toEqual([]);
		expect(beta.after[0]).toMatchObject({ cleared: true });
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
