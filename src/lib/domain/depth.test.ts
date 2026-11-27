import { describe, expect, it } from 'vitest';
import { compileCurriculum, type BranchFile, type Curriculum, type Depth } from '$lib/content/curriculum';
import type { Attempt } from '$lib/storage/types';
import { checkpointPassed, curriculumAt, deckAt, decksAt } from './depth.ts';
import { examPassed } from './exam.ts';
import { examDrills, projectCurriculum, teachingBySkill } from './mastery.ts';

type PathFile = BranchFile['paths'][number];
type DrillFile = BranchFile['drills'][number];

const level = (id: string, depth?: Depth) => (depth ? { id, title: id, depth } : { id, title: id });
const checkpoint = (id: string, extra: { requires?: string[]; mix?: string[] } = {}) => ({ id, title: id, summary: 'Combine them.', ...extra });
const pathFile = (id: string, levels: PathFile['levels'], checkpoints: PathFile['checkpoints'], extra: Partial<PathFile> = {}): PathFile => ({
	id,
	title: id,
	summary: 'A path.',
	after: [],
	levels,
	checkpoints,
	...extra
});
const drill = (questionId: string, path: string, disposition: DrillFile['disposition'], extra: Partial<DrillFile> = {}): DrillFile => ({
	questionId,
	path,
	disposition,
	note: 'Mapped.',
	...extra
});

function compile(paths: PathFile[], drills: DrillFile[], followUps: BranchFile['followUps'] = []): Curriculum {
	const withFollowUps = new Set((followUps ?? []).map((item) => item.questionId));
	return compileCurriculum(
		[{ id: 'foundations', title: 'Foundations', summary: 'A branch.', order: 1, paths, drills, followUps }],
		drills.map((item) => ({ deckId: 'deck', questionId: item.questionId, followUpIds: withFollowUps.has(item.questionId) ? ['wrong'] : [] }))
	);
}

/**
 * core: a fork with one deep skill, and a deep-only mix kind. plain: unnamed drills paired by position, one of each
 * kind deep. split: a checkpoint that requires only a deep skill. deeper: a deep path. hollow: an
 * interview path whose skills are all deep.
 */
const curriculum = compile(
	[
		pathFile('core', [level('core-a'), level('core-b')], [checkpoint('core-exam', { mix: ['trace', 'proof'] })], {
			forks: [{ id: 'side', title: 'Side', levels: [level('side-a'), level('side-b', 'deep')] }]
		}),
		pathFile(
			'plain',
			[level('plain-a'), level('plain-b'), level('plain-c')],
			[checkpoint('plain-first', { requires: ['plain-a'] }), checkpoint('plain-second', { requires: ['plain-b', 'plain-c'] })],
			{ after: ['core'] }
		),
		pathFile('split', [level('split-a'), level('split-b', 'deep')], [checkpoint('split-early', { requires: ['split-a'] }), checkpoint('split-late', { requires: ['split-b'] })]),
		pathFile('deeper', [level('deeper-a'), level('deeper-b')], [checkpoint('deeper-exam')], { after: ['core'], depth: 'deep' }),
		pathFile('hollow', [level('hollow-a', 'deep'), level('hollow-b', 'deep')], [checkpoint('hollow-exam')])
	],
	[
		drill('t-core-a', 'core', 'keep', { skill: 'core-a' }),
		drill('t-core-b', 'core', 'keep', { skill: 'core-b' }),
		drill('t-side-a', 'core', 'keep', { skill: 'side-a' }),
		drill('t-side', 'core', 'keep', { skill: 'side-b' }),
		drill('x-trace', 'core', 'exam', { tests: ['core-a'], covers: ['trace'] }),
		drill('x-proof', 'core', 'exam', { tests: ['side-b'], covers: ['proof'], depth: 'deep' }),
		drill('p1', 'plain', 'keep'),
		drill('p2', 'plain', 'keep', { depth: 'deep' }),
		drill('p3', 'plain', 'keep'),
		drill('p4', 'plain', 'rewrite'),
		drill('e1', 'plain', 'exam', { depth: 'deep' }),
		drill('e2', 'plain', 'exam'),
		drill('e3', 'plain', 'exam'),
		drill('r1', 'plain', 'retire', { depth: 'deep' }),
		drill('s-a', 'split', 'keep', { skill: 'split-a' }),
		drill('s-b', 'split', 'keep', { skill: 'split-b' }),
		drill('s-early', 'split', 'exam', { checkpoint: 'split-early', tests: ['split-a'] }),
		drill('s-late', 'split', 'exam', { checkpoint: 'split-late', tests: ['split-b'], depth: 'deep' }),
		drill('d1', 'deeper', 'keep'),
		drill('d2', 'deeper', 'exam'),
		drill('h1', 'hollow', 'keep', { skill: 'hollow-a' }),
		drill('h2', 'hollow', 'keep', { skill: 'hollow-b' }),
		drill('h3', 'hollow', 'exam', { depth: 'deep' })
	],
	[
		{ questionId: 't-core-a', optionId: 'wrong', disposition: 'keep', path: 'core', note: 'Kept.' },
		{ questionId: 't-side', optionId: 'wrong', disposition: 'keep', path: 'core', note: 'Kept.' }
	]
);

const pathOf = (at: Curriculum, id: string) => at.branches.flatMap((branch) => branch.paths).find((path) => path.id === id);
const ids = (drills: readonly { questionId: string }[] | undefined) => (drills ?? []).map((item) => item.questionId);

describe('curriculumAt', () => {
	const interview = curriculumAt(curriculum, 'interview');

	it('hides deep paths, paths with no interview skill, skills, fork skills, drills and follow-up overrides', () => {
		expect(interview.branches.flatMap((branch) => branch.paths).map((path) => path.id)).toEqual(['core', 'plain', 'split']);
		expect(pathOf(interview, 'core')!.skills.map((skill) => skill.id)).toEqual(['core-a', 'core-b', 'side-a']);
		expect(pathOf(interview, 'core')!.forks).toEqual([{ id: 'side', title: 'Side', after: null, skillIds: ['side-a'] }]);
		expect(pathOf(interview, 'split')!.skills.map((skill) => skill.id)).toEqual(['split-a']);
		expect(ids(interview.drills)).toEqual(['t-core-a', 't-core-b', 't-side-a', 'x-trace', 'p1', 'p3', 'p4', 'e2', 'e3', 's-a', 's-early']);
		expect(interview.followUps.map((item) => item.questionId)).toEqual(['t-core-a']);
	});

	it('drops deep skills from requires, deep-only kinds from mix, and a checkpoint left with no skill', () => {
		expect(pathOf(interview, 'core')!.checkpoints).toEqual([expect.objectContaining({ id: 'core-exam', requires: ['core-a', 'core-b', 'side-a'], mix: ['trace'] })]);
		expect(pathOf(interview, 'split')!.checkpoints.map((item) => item.id)).toEqual(['split-early']);
	});

	it('keeps each drill on the skill and checkpoint the full curriculum pairs it with', () => {
		const plain = pathOf(interview, 'plain')!;
		const teaching = teachingBySkill(plain, interview.drills);
		expect([...teaching].map(([skill, drills]) => [skill, ids(drills)])).toEqual([
			['plain-a', ['p1']],
			['plain-b', []],
			['plain-c', ['p3', 'p4']]
		]);
		const pools = examDrills(plain, interview.drills);
		expect([...pools].map(([id, drills]) => [id, ids(drills)])).toEqual([
			['plain-first', []],
			['plain-second', ['e2', 'e3']]
		]);
		// Filtering without pinning would move p3 onto plain-b and e2 onto plain-first.
		const unpinned = curriculum.drills.filter((item) => item.depth === 'interview');
		expect(ids(teachingBySkill(plain, unpinned).get('plain-b'))).toEqual(['p3']);
		expect(ids(examDrills(plain, unpinned).get('plain-first'))).toEqual(['e2']);
	});

	it('removes hidden ids from path and skill after lists', () => {
		const paths = curriculum.branches[0]!.paths.map((path) =>
			path.id === 'plain'
				? { ...path, after: [...path.after, 'deeper'], skills: path.skills.map((skill) => ({ ...skill, after: [...skill.after, 'deeper-b', 'side-b'] })) }
				: path
		);
		const tangled: Curriculum = { ...curriculum, branches: [{ ...curriculum.branches[0]!, paths }] };
		const plain = pathOf(curriculumAt(tangled, 'interview'), 'plain')!;
		expect(plain.after).toEqual(['core']);
		expect(plain.skills.map((skill) => skill.after)).toEqual([['core-b'], ['plain-a'], ['plain-b']]);
	});

	it('returns the input with pinned ids at the deepest level, without changing the input', () => {
		const before = structuredClone(curriculum);
		const pins: Record<string, { skillId?: string; checkpointId?: string }> = {
			'x-trace': { checkpointId: 'core-exam' },
			'x-proof': { checkpointId: 'core-exam' },
			p1: { skillId: 'plain-a' },
			p2: { skillId: 'plain-b' },
			p3: { skillId: 'plain-c' },
			p4: { skillId: 'plain-c' },
			e1: { checkpointId: 'plain-first' },
			e2: { checkpointId: 'plain-second' },
			e3: { checkpointId: 'plain-second' },
			d1: { skillId: 'deeper-a' },
			d2: { checkpointId: 'deeper-exam' },
			h3: { checkpointId: 'hollow-exam' }
		};
		expect(curriculumAt(curriculum, 'deep')).toEqual({
			...curriculum,
			drills: curriculum.drills.map((item) => ({ ...item, ...pins[item.questionId] }))
		});
		expect(curriculum).toEqual(before);
	});

	it('keeps the order of every pairing when a path mixes named and unnamed drills', () => {
		// Pairing lists unnamed drills first: m-a gets [u1, n1] and the checkpoint [c2, c1], against list order.
		const mixed = compile(
			[pathFile('mixed', [level('m-a'), level('m-b')], [checkpoint('m-exam')])],
			[
				drill('n1', 'mixed', 'keep', { skill: 'm-a' }),
				drill('u1', 'mixed', 'keep'),
				drill('u2', 'mixed', 'keep'),
				drill('c1', 'mixed', 'exam', { checkpoint: 'm-exam' }),
				drill('c2', 'mixed', 'exam')
			]
		);
		const path = pathOf(mixed, 'mixed')!;
		const order = (pairs: Map<string, readonly { questionId: string }[]>) => [...pairs].map(([id, drills]) => [id, ids(drills)]);
		expect(order(teachingBySkill(path, mixed.drills))).toEqual([
			['m-a', ['u1', 'n1']],
			['m-b', ['u2']]
		]);
		for (const at of [curriculumAt(mixed, 'deep'), curriculumAt(mixed, 'interview')]) {
			expect(order(teachingBySkill(path, at.drills))).toEqual(order(teachingBySkill(path, mixed.drills)));
			expect(order(examDrills(path, at.drills))).toEqual([['m-exam', ['c2', 'c1']]]);
		}
	});

	it('drops a branch with no visible path', () => {
		const branchFile = (id: string, order: number, path: PathFile, drills: DrillFile[]): BranchFile => ({ id, title: id, summary: 'A branch.', order, paths: [path], drills });
		const two = compileCurriculum(
			[
				branchFile('foundations', 1, pathFile('open', [level('open-a'), level('open-b')], [checkpoint('open-exam')]), [drill('o1', 'open', 'exam')]),
				branchFile('advanced', 2, pathFile('later', [level('later-a'), level('later-b')], [checkpoint('later-exam')], { depth: 'deep' }), [drill('l1', 'later', 'exam')])
			],
			['o1', 'l1'].map((questionId) => ({ deckId: 'deck', questionId, followUpIds: [] }))
		);
		expect(curriculumAt(two, 'interview').branches.map((branch) => branch.id)).toEqual(['foundations']);
		expect(curriculumAt(two, 'deep').branches.map((branch) => branch.id)).toEqual(['foundations', 'advanced']);
	});
});

describe('decksAt and deckAt', () => {
	const depths = { q2: 'deep', q4: 'deep' } as const;
	const decks = [
		{ id: 'mixed', questions: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }, { id: 'constructor' }] },
		{ id: 'deep-only', questions: [{ id: 'q4' }] }
	];

	it('keeps the questions at or below the level in file order, treating an unmapped id as interview', () => {
		expect(decksAt(decks, 'interview', depths)).toEqual([{ id: 'mixed', questions: [{ id: 'q1' }, { id: 'q3' }, { id: 'constructor' }] }]);
		expect(decksAt(decks, 'deep', depths)).toEqual(decks);
	});

	it('returns an empty deck for a deck with nothing visible', () => {
		expect(deckAt(decks[1]!, 'interview', depths)).toEqual({ id: 'deep-only', questions: [] });
	});
});

function attempt(questionId: string, correct: boolean, day = '2026-01-01'): Attempt {
	return { id: `${questionId}-${day}`, at: `${day}T12:00:00.000Z`, day, deckId: 'deck', questionId, pickedId: correct ? 'yes' : 'no', correct };
}
const sitting = (right: string[], wrong: string[] = [], day?: string) => [
	...right.map((id) => attempt(id, true, day)),
	...wrong.map((id) => attempt(id, false, day))
];

describe('checkpointPassed', () => {
	// Interview pool of 4 (g1 to g4); the deep pool adds g5 and g6, so a deep sitting is 5 items.
	const gated = compile(
		[pathFile('gate', [level('gate-a'), level('gate-b')], [checkpoint('gate-exam')])],
		[
			drill('g1', 'gate', 'exam'),
			drill('g2', 'gate', 'exam'),
			drill('g3', 'gate', 'exam'),
			drill('g4', 'gate', 'exam'),
			drill('g5', 'gate', 'exam', { depth: 'deep' }),
			drill('g6', 'gate', 'exam', { depth: 'deep' })
		]
	);
	const interviewPool = examDrills(pathOf(gated, 'gate')!, curriculumAt(gated, 'interview').drills).get('gate-exam')!;

	it('counts a full deep sitting at every level, though the interview pool alone would not pass it', () => {
		const attempts = sitting(['g1', 'g2', 'g3', 'g5', 'g6']);
		expect(examPassed(interviewPool, [], attempts)).toBe(false);
		expect(checkpointPassed(gated, 'gate-exam', attempts)).toBe(true);
	});

	it('counts a 4-item interview sitting at every level, though the deep pool needs 5', () => {
		expect(checkpointPassed(gated, 'gate-exam', sitting(['g1', 'g2', 'g3', 'g4']))).toBe(true);
	});

	it('fails a sitting with two misses on interview items at every level', () => {
		expect(checkpointPassed(gated, 'gate-exam', sitting(['g3', 'g4', 'g5'], ['g1', 'g2']))).toBe(false);
	});

	it('passes at interview when one of two misses was on a deep item', () => {
		expect(checkpointPassed(gated, 'gate-exam', sitting(['g2', 'g3', 'g4'], ['g1', 'g5']))).toBe(true);
	});

	it('passes a pool smaller than a sitting once every item is right on one day', () => {
		expect(checkpointPassed(curriculum, 'plain-second', sitting(['e2', 'e3']))).toBe(true);
		expect(checkpointPassed(curriculum, 'plain-second', [attempt('e2', true), attempt('e3', true, '2026-01-02')])).toBe(false);
	});

	it('counts a pass on a checkpoint only the deep level shows, and is false for an unknown checkpoint', () => {
		expect(checkpointPassed(curriculum, 'deeper-exam', sitting(['d2']))).toBe(true);
		expect(checkpointPassed(curriculum, 'split-late', sitting(['s-late']))).toBe(true);
		expect(checkpointPassed(curriculum, 'deeper-exam', [])).toBe(false);
		expect(checkpointPassed(curriculum, 'no-such-exam', sitting(['d2']))).toBe(false);
	});

	it('is false for a checkpoint with no exam drill at any level', () => {
		const bare = compile([pathFile('bare', [level('bare-a'), level('bare-b')], [checkpoint('bare-exam')])], [drill('b1', 'bare', 'keep')]);
		expect(checkpointPassed(bare, 'bare-exam', sitting(['b1']))).toBe(false);
	});
});

describe('projectCurriculum at a level', () => {
	const pathsOf = (tree: ReturnType<typeof projectCurriculum>) => tree.branches.flatMap((branch) => branch.paths);
	const viewOf = (tree: ReturnType<typeof projectCurriculum>, id: string) => pathsOf(tree).find((path) => path.id === id)!;
	const coreSkills = sitting(['t-core-a', 't-core-b', 't-side-a']);

	it('shows only the paths, skills, forks, checkpoints and drills the level shows', () => {
		const tree = projectCurriculum(curriculum, [], 'interview');
		expect(pathsOf(tree).map((path) => path.id)).toEqual(['core', 'plain', 'split']);
		const core = viewOf(tree, 'core');
		expect(core.forks.map((fork) => fork.skills.map((skill) => skill.id))).toEqual([['side-a']]);
		expect(core.checkpoints[0]!.drills.map((item) => item.questionId)).toEqual(['x-trace']);
		expect(core.checkpoints[0]!.sitting).toBe(1);
		expect(viewOf(projectCurriculum(curriculum, [], 'deep'), 'core').checkpoints[0]!.sitting).toBe(2);
		expect(viewOf(tree, 'split').checkpoints.map((item) => item.id)).toEqual(['split-early']);
		expect(viewOf(tree, 'plain').main.map((skill) => skill.drills.map((item) => item.questionId))).toEqual([['p1'], [], ['p3', 'p4']]);
		expect(pathsOf(projectCurriculum(curriculum, [], 'deep')).map((path) => path.id)).toEqual(['core', 'plain', 'split', 'deeper', 'hollow']);
	});

	it('opens a checkpoint once its interview skills are mastered, while the deep level still waits on the deep one', () => {
		expect(viewOf(projectCurriculum(curriculum, coreSkills, 'interview'), 'core').checkpoints[0]!.state).toBe('available');
		const deep = viewOf(projectCurriculum(curriculum, coreSkills, 'deep'), 'core').checkpoints[0]!;
		expect(deep.state).toBe('locked');
		expect(deep.remaining.map((item) => item.id)).toEqual(['side-b']);
	});

	it('shows a checkpoint passed at either level as passed at both', () => {
		// The interview pool is x-trace alone, a one-item sitting; the deep pool needs x-proof too.
		const interviewPass = [...coreSkills, attempt('x-trace', true, '2026-01-02')];
		expect(viewOf(projectCurriculum(curriculum, interviewPass, 'deep'), 'core').checkpoints[0]!.state).toBe('passed');
		const deepPass = sitting(['x-trace', 'x-proof'], [], '2026-01-02');
		expect(viewOf(projectCurriculum(curriculum, deepPass, 'interview'), 'core').checkpoints[0]!.state).toBe('passed');
		expect(viewOf(projectCurriculum(curriculum, deepPass, 'deep'), 'deeper').after[0]).toEqual(expect.objectContaining({ id: 'core', cleared: true }));
	});

	it('clears a path whose only unpassed checkpoint has no exam drill at the level', () => {
		// split comes after plain. At interview plain-first has no exam drill (e1 is deep), so passing plain-second clears plain.
		const paths = curriculum.branches[0]!.paths.map((path) => (path.id === 'split' ? { ...path, after: ['plain'] } : path));
		const chained: Curriculum = { ...curriculum, branches: [{ ...curriculum.branches[0]!, paths }] };
		const passedSecond = sitting(['e2', 'e3']);
		expect(viewOf(projectCurriculum(chained, passedSecond, 'interview'), 'split').after[0]!.cleared).toBe(true);
		expect(viewOf(projectCurriculum(chained, passedSecond, 'deep'), 'split').after[0]!.cleared).toBe(false);
	});

	it('leaves a skill whose only drills are deep not started at interview', () => {
		const plainB = viewOf(projectCurriculum(curriculum, [attempt('p2', true)], 'interview'), 'plain').main[1]!;
		expect(plainB.state).toBe('unexplored');
		expect(viewOf(projectCurriculum(curriculum, [attempt('p2', true)], 'deep'), 'plain').main[1]!.state).toBe('mastered');
	});
});
