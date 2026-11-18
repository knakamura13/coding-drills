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
	'sequences-and-search': { keep: 3, rewrite: 9, exam: 11, retire: 1 },
	'data-structures': { keep: 3, rewrite: 7, exam: 8, retire: 0 },
	'trees-and-graphs': { keep: 1, rewrite: 7, exam: 10, retire: 0 },
	'problem-solving-patterns': { keep: 1, rewrite: 9, exam: 12, retire: 0 }
};

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

	it('lists the 43 skill paths in plan order', () => {
		expect(paths.map((item) => item.title)).toEqual(PATH_TITLES);
	});

	it('maps each of the 94 primary drills once, onto a real question', () => {
		expect(curriculum.drills).toHaveLength(94);
		expect(new Set(curriculum.drills.map((drill) => drill.questionId)).size).toBe(94);
		const known = new Map(decks.flatMap((deck) => deck.questions.map((question) => [question.id, deck.id])));
		expect(known.size).toBe(94);
		for (const drill of curriculum.drills) {
			expect(known.get(drill.questionId), drill.questionId).toBe(drill.deckId);
		}
	});

	it('matches the per-branch keep, rewrite, exam, and retire counts', () => {
		for (const [branchId, expected] of Object.entries(COUNTS)) {
			const counts: Record<string, number> = { keep: 0, rewrite: 0, exam: 0, retire: 0 };
			for (const drill of curriculum.drills.filter((item) => {
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

	it('keeps the retired drill mapped and does not drop it', () => {
		const retired = curriculum.drills.find((drill) => drill.questionId === 'subarray-sum-k');
		expect(retired).toMatchObject({ disposition: 'retire', pathId: 'prefix-counts' });
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
