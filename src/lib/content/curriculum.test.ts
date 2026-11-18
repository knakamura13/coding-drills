import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadDecks } from './loadDecks.ts';
import { loadCurriculum } from './loadCurriculum.ts';
import { compileCurriculum, type BranchFile, type SourceQuestion } from './curriculum.ts';

const PATH_TITLES = [
	'Arrays and strings',
	'Problem-solving routine',
	'Names and objects',
	'Growth rates',
	'Operation costs',
	'Hidden work',
	'Exact search',
	'Boundary search',
	'Feasible limits',
	'Hash lookups',
	'Prefix counts',
	'Sort order',
	'Interval merging',
	'Event sweeps',
	'Pointer scans',
	'Variable windows',
	'Window limits',
	'Stack matching',
	'Monotonic stack',
	'Priority order',
	'Heap operations',
	'Bounded heaps',
	'Link rewrites',
	'Pointer walks',
	'Reachability',
	'Traversal layers',
	'Connectivity',
	'Dependency order',
	'Weighted paths',
	'Tree walks',
	'BST order',
	'Tree summaries',
	'Recursive calls',
	'Search state',
	'Enumerating choices',
	'Repeated states',
	'One-dimensional tables',
	'Grid tables',
	'Subsequence tables',
	'DP storage',
	'Greedy choices',
	'Greedy scheduling',
	'Method selection'
];

const COUNTS: Record<string, Record<string, number>> = {
	foundations: { keep: 6, rewrite: 2, exam: 4, retire: 0 },
	'sequences-and-search': { keep: 3, rewrite: 8, exam: 11, retire: 2 },
	'data-structures': { keep: 3, rewrite: 7, exam: 8, retire: 0 },
	'trees-and-graphs': { keep: 1, rewrite: 7, exam: 10, retire: 0 },
	'problem-solving-patterns': { keep: 1, rewrite: 9, exam: 12, retire: 0 }
};

/** The 16 decks audited for #9. Decks written later for a path are mapped too, but stay out of these counts. */
const AUDITED_DECKS = new Set([
	'binary-search-on-answer',
	'complexity-analysis',
	'cost-python-data-model',
	'graph-algorithms',
	'graph-traversal-grids',
	'hash-maps-prefix-sums',
	'heaps-top-k',
	'linked-lists',
	'monotonic-stack',
	'one-dimensional-dp',
	'pattern-identification',
	'recursion-backtracking',
	'sorting-interval-sweeps',
	'trees-traversals-bst',
	'two-dimensional-dp-greedy',
	'two-pointers-sliding-window'
]);

const ARRAYS_AND_STRINGS_DECKS = new Set(['arrays-and-strings', 'arrays-and-strings-review', 'arrays-and-strings-checkpoint']);

function level(id: string) {
	return { id, title: id };
}

function path(id: string, after: string[] = []): BranchFile['paths'][number] {
	return {
		id,
		title: id,
		summary: 'A path.',
		after,
		levels: [level(`${id}-a`), level(`${id}-b`)],
		checkpoints: [{ id: `${id}-exam`, title: 'Exam', summary: 'Combine them.' }]
	};
}

function branch(id: string, order: number, paths: BranchFile['paths'], drills: BranchFile['drills'] = []): BranchFile {
	return { id, title: id, summary: 'A branch.', order, paths, drills };
}

function questions(...ids: string[]): SourceQuestion[] {
	return ids.map((questionId) => ({ deckId: 'deck', questionId, followUpIds: [] }));
}

describe('shipped curriculum', () => {
	const curriculum = loadCurriculum('content/curriculum', 'content/decks');
	const decks = loadDecks('content/decks');
	const paths = curriculum.branches.flatMap((item) => item.paths);
	const audited = curriculum.drills.filter((drill) => AUDITED_DECKS.has(drill.deckId));

	it('lists the 43 skill paths in plan order', () => {
		expect(paths.map((item) => item.title)).toEqual(PATH_TITLES);
	});

	it('maps each of the 94 primary drills once, onto a real question', () => {
		expect(audited).toHaveLength(94);
		expect(new Set(audited.map((drill) => drill.questionId)).size).toBe(94);
		const known = new Map(
			decks
				.filter((deck) => AUDITED_DECKS.has(deck.id))
				.flatMap((deck) => deck.questions.map((question) => [question.id, deck.id]))
		);
		expect(known.size).toBe(94);
		for (const drill of audited) {
			expect(known.get(drill.questionId), drill.questionId).toBe(drill.deckId);
		}
	});

	it('maps the 22 new Arrays and strings drills onto that path', () => {
		const added = curriculum.drills.filter((drill) => ARRAYS_AND_STRINGS_DECKS.has(drill.deckId));
		const questions = decks.filter((deck) => ARRAYS_AND_STRINGS_DECKS.has(deck.id)).flatMap((deck) => deck.questions);
		expect(added).toHaveLength(22);
		expect(added.map((drill) => drill.questionId).sort()).toEqual(questions.map((question) => question.id).sort());
		for (const drill of added) {
			expect(drill.pathId, drill.questionId).toBe('arrays-and-strings');
			expect(drill.disposition, drill.questionId).toBe(drill.deckId === 'arrays-and-strings-checkpoint' ? 'exam' : 'keep');
		}
	});

	it('matches the per-branch keep, rewrite, exam, and retire counts', () => {
		for (const [branchId, expected] of Object.entries(COUNTS)) {
			const counts: Record<string, number> = { keep: 0, rewrite: 0, exam: 0, retire: 0 };
			for (const drill of audited.filter((item) => {
				const path = paths.find((candidate) => candidate.id === item.pathId);
				return path?.branchId === branchId;
			})) {
				counts[drill.disposition] += 1;
			}
			expect(counts, branchId).toEqual(expected);
		}
	});

	it('gives every checkpoint the skills that lead into it, including a converging path', () => {
		const byId = new Map(paths.map((item) => [item.id, item]));
		expect(paths.flatMap((item) => item.checkpoints)).toHaveLength(44);
		for (const item of paths) {
			const skillIds = new Set(item.skills.map((skill) => skill.id));
			for (const skill of item.skills) expect(skillIds.has(skill.id)).toBe(true);
			const covered = item.checkpoints.flatMap((checkpoint) => checkpoint.requires);
			for (const skillId of skillIds) expect(covered, item.id).toContain(skillId);
		}

		const feasible = byId.get('feasible-limits')!.checkpoints[0]!;
		for (const skillId of ['discard-sorted-half', 'identify-local-rule', 'price-primitive', 'evaluate-one-limit']) {
			expect(feasible.requires, skillId).toContain(skillId);
		}
		expect(feasible.requires).not.toContain('follow-reference');

		const boundary = byId.get('boundary-search')!;
		expect(boundary.checkpoints.map((checkpoint) => checkpoint.requires)).toEqual([
			['locate-insertion-boundary', 'retain-equal-side'],
			['identify-sorted-half', 'choose-rotated-side']
		]);
		expect(boundary.forks.map((fork) => fork.id)).toEqual(['rotated-range']);

		const monotonic = byId.get('monotonic-stack')!.checkpoints[0]!;
		expect(monotonic.requires).toContain('read-index');
		expect(monotonic.requires).toContain('push-pop-recent');
		expect(monotonic.requires).toContain('count-operations');
	});

	it('records the follow-up exceptions and no others', () => {
		expect(curriculum.followUps.map((item) => `${item.questionId}/${item.optionId} ${item.disposition} ${item.pathId}`)).toEqual([
			'sorted-array-search-loop/lt-inclusive rewrite exact-search',
			'sorted-array-search-loop/lo-equals-mid exam exact-search',
			'binary-search-preconditions/linked-list-ok rewrite operation-costs',
			'binary-search-preconditions/python-overflow retire exact-search',
			'subarray-sum-k/sort-sweep rewrite method-selection',
			'heapq-min-heap/plain-pops keep priority-order',
			'grid-bounds-and-cost/quadratic rewrite reachability',
			'count-components-edge-list/one-search rewrite reachability',
			'shortest-path-grid/dijkstra rewrite weighted-paths',
			'tiling-recurrence/empty-is-zero rewrite one-dimensional-tables'
		]);
	});

	it('puts every teaching drill drafted for a path on one of its skills, each skill with several', () => {
		// A path is drafted once any of its drills names a skill. Audited drills that predate skill ids
		// stay positional, so they are skipped (for example the rewrites a new drill replaces).
		const drafted = new Set(curriculum.drills.filter((drill) => drill.skillId).map((drill) => drill.pathId));
		expect([...drafted]).toEqual(expect.arrayContaining(['arrays-and-strings', 'pointer-scans']));
		for (const pathId of drafted) {
			const item = paths.find((candidate) => candidate.id === pathId)!;
			const teaching = curriculum.drills.filter(
				(drill) => drill.pathId === pathId && (drill.disposition === 'keep' || drill.disposition === 'rewrite')
			);
			const perSkill = new Map(item.skills.map((skill) => [skill.id, 0]));
			for (const drill of teaching) {
				if (AUDITED_DECKS.has(drill.deckId) && !drill.skillId) continue;
				expect(perSkill.has(drill.skillId ?? ''), drill.questionId).toBe(true);
				perSkill.set(drill.skillId!, perSkill.get(drill.skillId!)! + 1);
			}
			for (const [skillId, count] of perSkill) expect(count, `${pathId}/${skillId}`).toBeGreaterThanOrEqual(3);
		}
	});

	it('names the skills each drafted exam item checks, on its own path', () => {
		for (const pathId of ['arrays-and-strings', 'exact-search', 'pointer-scans']) {
			const item = paths.find((candidate) => candidate.id === pathId)!;
			const skillIds = new Set(item.skills.map((skill) => skill.id));
			const exams = curriculum.drills.filter((drill) => drill.pathId === pathId && drill.disposition === 'exam');
			expect(exams.length, pathId).toBeGreaterThan(0);
			for (const drill of exams) {
				expect(drill.tests?.length ?? 0, drill.questionId).toBeGreaterThan(0);
				for (const tested of drill.tests!) expect(skillIds.has(tested), `${drill.questionId} tests ${tested}`).toBe(true);
			}
		}
	});

	it('keeps the retired drills mapped and does not drop them', () => {
		const retired = curriculum.drills.find((drill) => drill.questionId === 'subarray-sum-k');
		expect(retired).toMatchObject({ disposition: 'retire', pathId: 'prefix-counts' });
		const keepDistinct = curriculum.drills.find((drill) => drill.questionId === 'slow-fast-keep-distinct');
		expect(keepDistinct).toMatchObject({ disposition: 'retire', pathId: 'pointer-scans' });
	});

	it('lets Pointer scans start without Sort order, and keeps unique pairs and compaction in every exam', () => {
		const pointerScans = paths.find((item) => item.id === 'pointer-scans')!;
		expect(pointerScans.after).toEqual(['arrays-and-strings']);
		expect(pointerScans.afterNote).toMatch(/sorted input/);
		const [checkpoint] = pointerScans.checkpoints;
		expect(checkpoint!.mix).toEqual(['unique-pairs', 'compaction']);
		const exams = curriculum.drills.filter((drill) => drill.pathId === 'pointer-scans' && drill.disposition === 'exam');
		for (const kind of checkpoint!.mix) {
			expect(exams.some((drill) => drill.covers.includes(kind)), kind).toBe(true);
		}
	});
});

describe('compileCurriculum', () => {
	it('rejects a question that is mapped twice or not at all', () => {
		const files = [branch('foundations', 1, [path('arrays')], [{ questionId: 'only', disposition: 'keep', path: 'arrays', note: 'Keep it.' }])];
		expect(() => compileCurriculum(files, questions('only', 'other'))).toThrow(/other.*not mapped/);
		const twice = [
			branch('foundations', 1, [path('arrays')], [
				{ questionId: 'only', disposition: 'keep', path: 'arrays', note: 'Keep it.' },
				{ questionId: 'only', disposition: 'exam', path: 'arrays', note: 'Again.' }
			])
		];
		expect(() => compileCurriculum(twice, questions('only'))).toThrow(/mapped more than once/);
	});

	it('rejects a drill that is not a real question id', () => {
		const files = [branch('foundations', 1, [path('arrays')], [{ questionId: 'missing', disposition: 'keep', path: 'arrays', note: 'No.' }])];
		expect(() => compileCurriculum(files, [])).toThrow(/not a question id/);
	});

	it('rejects a cycle across paths', () => {
		const files = [branch('foundations', 1, [path('left', ['right']), path('right', ['left'])])];
		expect(() => compileCurriculum(files, [])).toThrow(/cycle/);
	});

	it('rejects a follow-up whose option is not on that question', () => {
		const files: BranchFile[] = [
			{
				...branch(
					'foundations',
					1,
					[path('arrays')],
					[{ questionId: 'only', disposition: 'keep', path: 'arrays', note: 'Keep it.' }]
				),
				followUps: [{ questionId: 'only', optionId: 'nope', disposition: 'rewrite', path: 'arrays', note: 'No such option.' }]
			}
		];
		const asked: SourceQuestion[] = [{ deckId: 'deck', questionId: 'only', followUpIds: ['real'] }];
		expect(() => compileCurriculum(files, asked)).toThrow(/not a follow-up/);
	});

	it('checks the skills an exam drill tests against its path and its disposition', () => {
		const make = (tests: string[], disposition: 'exam' | 'keep' = 'exam'): BranchFile[] => [
			branch('foundations', 1, [path('alpha')], [{ questionId: 'one', disposition, path: 'alpha', tests, note: 'Exam.' }])
		];
		expect(compileCurriculum(make(['alpha-a', 'alpha-b']), questions('one')).drills[0]).toMatchObject({ tests: ['alpha-a', 'alpha-b'] });
		expect(() => compileCurriculum(make(['elsewhere']), questions('one'))).toThrow(/not on path "alpha"/);
		expect(() => compileCurriculum(make(['alpha-a'], 'keep'), questions('one'))).toThrow(/only an exam drill/);
	});

	it('checks the checkpoint an exam drill names against its path and its disposition', () => {
		const two = path('alpha');
		two.checkpoints = [
			{ id: 'first', title: 'First', summary: 'One.', requires: ['alpha-a'] },
			{ id: 'second', title: 'Second', summary: 'Two.', requires: ['alpha-b'] }
		];
		const make = (checkpoint: string, disposition: 'exam' | 'keep' = 'exam'): BranchFile[] => [
			branch('foundations', 1, [two], [{ questionId: 'one', disposition, path: 'alpha', checkpoint, note: 'Exam.' }])
		];
		expect(compileCurriculum(make('second'), questions('one')).drills[0]).toMatchObject({ checkpointId: 'second' });
		expect(() => compileCurriculum(make('nope'), questions('one'))).toThrow(/not on path "alpha"/);
		expect(() => compileCurriculum(make('second', 'keep'), questions('one'))).toThrow(/only an exam drill/);
	});

	it('requires an exam drill to cover each kind in a checkpoint mix', () => {
		const mixed = (covers?: string[], disposition: 'exam' | 'keep' = 'exam'): BranchFile[] => {
			const alpha = path('alpha');
			alpha.checkpoints = [{ id: 'alpha-exam', title: 'Exam', summary: 'Combine them.', mix: ['pairs', 'edits'] }];
			return [
				branch('foundations', 1, [alpha], [
					{ questionId: 'one', disposition: 'exam', path: 'alpha', covers: ['pairs'], note: 'Pairs.' },
					{ questionId: 'two', disposition, path: 'alpha', ...(covers ? { covers } : {}), note: 'Edits.' }
				])
			];
		};
		expect(() => compileCurriculum(mixed(), questions('one', 'two'))).toThrow(/no exam drill covers "edits"/);
		expect(() => compileCurriculum(mixed(['edits'], 'keep'), questions('one', 'two'))).toThrow(/only an exam drill/);
		const compiled = compileCurriculum(mixed(['edits']), questions('one', 'two'));
		expect(compiled.branches[0]!.paths[0]!.checkpoints[0]!.mix).toEqual(['pairs', 'edits']);
		expect(compiled.drills.map((item) => item.covers)).toEqual([['pairs'], ['edits']]);
	});

	it('checks the skill a drill names against its path and its disposition', () => {
		const make = (skill: string, disposition: 'keep' | 'exam' = 'keep'): BranchFile[] => [
			branch('foundations', 1, [path('alpha'), path('beta')], [
				{ questionId: 'one', disposition, path: 'alpha', skill, note: 'Teach it.' }
			])
		];
		const compiled = compileCurriculum(make('alpha-b'), questions('one'));
		expect(compiled.drills[0]).toMatchObject({ skillId: 'alpha-b' });
		expect(() => compileCurriculum(make('beta-a'), questions('one'))).toThrow(/not on path "alpha"/);
		expect(() => compileCurriculum(make('alpha-a', 'exam'), questions('one'))).toThrow(/only a keep or rewrite/);
	});

	it('rejects a mix on a path with two checkpoints', () => {
		const alpha = path('alpha');
		alpha.checkpoints = [
			{ id: 'first', title: 'First', summary: 'One.', requires: ['alpha-a'], mix: ['pairs'] },
			{ id: 'second', title: 'Second', summary: 'Two.', requires: ['alpha-b'] }
		];
		expect(() => compileCurriculum([branch('foundations', 1, [alpha])], [])).toThrow(/needs a path with one checkpoint/);
	});

	it('adds every skill from each converging path to the single checkpoint', () => {
		const files = [
			branch('foundations', 1, [path('alpha'), path('beta'), path('joined', ['alpha', 'beta'])])
		];
		const compiled = compileCurriculum(files, []);
		const joined = compiled.branches[0]!.paths[2]!.checkpoints[0]!;
		expect(joined.requires).toEqual(['joined-a', 'joined-b', 'alpha-a', 'alpha-b', 'beta-a', 'beta-b']);
	});
});

const scratch: string[] = [];

afterEach(() => {
	for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('loadCurriculum files', () => {
	it('rejects a branch id that does not match the file name', () => {
		const dir = mkdtempSync(join(tmpdir(), 'curriculum-'));
		const decks = mkdtempSync(join(tmpdir(), 'decks-'));
		scratch.push(dir, decks);
		writeFileSync(
			join(dir, 'wrong.yaml'),
			`id: foundations\ntitle: Foundations\nsummary: Shared.\norder: 1\npaths:\n  - id: arrays\n    title: Arrays\n    summary: Read.\n    after: []\n    levels:\n      - { id: a, title: A }\n      - { id: b, title: B }\n    checkpoints:\n      - { id: exam, title: Exam, summary: Combine. }\ndrills: []\n`
		);
		expect(() => loadCurriculum(dir, decks)).toThrow(/must match the file name/);
	});
});
