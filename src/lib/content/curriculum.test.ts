import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadDecks } from './loadDecks.ts';
import { loadCurriculum } from './loadCurriculum.ts';
import { branchSchema, compileCurriculum, MAX_PATH_SKILLS, type BranchFile, type SourceQuestion } from './curriculum.ts';
import { DEFAULT_DEPTH, DEPTHS, depthMap, visibleAt, type Depth } from './depth.ts';
import { depths } from 'virtual:depths';
import { curriculumAt } from '$lib/domain/depth';
import { EXAM_SIZE } from '$lib/domain/exam';
import { examDrills, projectCurriculum, teachingBySkill } from '$lib/domain/mastery';

const PATH_TITLES = [
	'Arrays and strings',
	'Names and objects',
	'Problem-solving routine',
	'Growth rates',
	'Operation costs',
	'Hidden work',
	'Bit manipulation',
	'Exact search',
	'Boundary search',
	'Pointer scans',
	'Palindromes',
	'Grid indices',
	'Substring search',
	'Sort order',
	'Interval merging',
	'Event sweeps',
	'Hash lookups',
	'Prefix counts',
	'Variable windows',
	'Window limits',
	'Feasible limits',
	'Stack matching',
	'Monotonic stack',
	'Priority order',
	'Heap operations',
	'Bounded heaps',
	'Link rewrites',
	'Pointer walks',
	'Design structures',
	'Reachability',
	'Traversal layers',
	'Connectivity',
	'Dependency order',
	'Weighted paths',
	'Minimum spanning trees',
	'Tree walks',
	'BST order',
	'Tree summaries',
	'Tree answers',
	'Tries',
	'Greedy choices',
	'Greedy scheduling',
	'Recursion',
	'Backtracking',
	'Backtracking: subsets and orderings',
	'Memoization',
	'Dynamic programming: 1D tables',
	'Dynamic programming: grids',
	'Dynamic programming: two strings',
	'DP: saving space',
	'Method selection'
];

const COUNTS: Record<string, Record<string, number>> = {
	foundations: { keep: 0, rewrite: 0, exam: 0, retire: 12 },
	'sequences-and-search': { keep: 0, rewrite: 0, exam: 0, retire: 24 },
	'data-structures': { keep: 12, rewrite: 0, exam: 0, retire: 12 },
	'trees-and-graphs': { keep: 0, rewrite: 0, exam: 0, retire: 18 },
	'problem-solving-patterns': { keep: 0, rewrite: 0, exam: 0, retire: 22 }
};

/**
 * The 16 deck ids audited for #9. Fifteen still hold only their retired questions. `monotonic-stack`
 * was rewritten under its old id, so its current teaching cards are counted too. Every other deck
 * written later is mapped but stays out of these counts.
 */
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

describe('path length', () => {
	it(`allows up to ${MAX_PATH_SKILLS} skills on a path and rejects one more`, () => {
		const withSkills = (count: number) => {
			const long = path('long');
			long.levels = Array.from({ length: count }, (_, index) => level(`long-${index}`));
			return branch('foundations', 1, [long]);
		};
		expect(branchSchema.safeParse(withSkills(MAX_PATH_SKILLS)).success).toBe(true);
		expect(branchSchema.safeParse(withSkills(MAX_PATH_SKILLS + 1)).success).toBe(false);
	});
});

describe('shipped curriculum', () => {
	const curriculum = loadCurriculum('content/curriculum', 'content/decks');
	const decks = loadDecks('content/decks');
	const paths = curriculum.branches.flatMap((item) => item.paths);
	const audited = curriculum.drills.filter((drill) => AUDITED_DECKS.has(drill.deckId));

	it('lists the 51 skill paths in plan order', () => {
		expect(paths.map((item) => item.title)).toEqual(PATH_TITLES);
	});

	it('maps each of the 100 drills in the audited deck ids once, onto a real question', () => {
		expect(audited).toHaveLength(100);
		expect(new Set(audited.map((drill) => drill.questionId)).size).toBe(100);
		const known = new Map(
			decks
				.filter((deck) => AUDITED_DECKS.has(deck.id))
				.flatMap((deck) => deck.questions.map((question) => [question.id, deck.id]))
		);
		expect(known.size).toBe(100);
		for (const drill of audited) {
			expect(known.get(drill.questionId), drill.questionId).toBe(drill.deckId);
		}
	});

	it('maps the 27 Arrays and strings drills onto that path', () => {
		const added = curriculum.drills.filter((drill) => ARRAYS_AND_STRINGS_DECKS.has(drill.deckId));
		const questions = decks.filter((deck) => ARRAYS_AND_STRINGS_DECKS.has(deck.id)).flatMap((deck) => deck.questions);
		expect(added).toHaveLength(27);
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
		expect(paths.flatMap((item) => item.checkpoints)).toHaveLength(52);
		for (const item of paths) {
			const skillIds = new Set(item.skills.map((skill) => skill.id));
			for (const skill of item.skills) expect(skillIds.has(skill.id)).toBe(true);
			const covered = item.checkpoints.flatMap((checkpoint) => checkpoint.requires);
			for (const skillId of skillIds) expect(covered, item.id).toContain(skillId);
		}

		const feasible = byId.get('feasible-limits')!.checkpoints[0]!;
		for (const skillId of [
			'locate-insertion-boundary',
			'retain-equal-side',
			'identify-sorted-half',
			'choose-rotated-side',
			'identify-local-rule',
			'price-primitive',
			'evaluate-one-limit'
		]) {
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
			'sorted-array-search-loop/lt-inclusive retire exact-search',
			'sorted-array-search-loop/lo-equals-mid retire exact-search',
			'binary-search-preconditions/linked-list-ok retire operation-costs',
			'binary-search-preconditions/python-overflow retire exact-search',
			'subarray-sum-k/sort-sweep retire method-selection',
			'heapq-min-heap/plain-pops retire priority-order',
			'grid-bounds-and-cost/quadratic retire reachability',
			'count-components-edge-list/one-search retire reachability',
			'shortest-path-grid/dijkstra retire weighted-paths',
			'tiling-recurrence/empty-is-zero retire one-dimensional-tables'
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
		for (const pathId of [
			'arrays-and-strings',
			'exact-search',
			'pointer-scans',
			'palindromes',
			'grid-indices',
			'sort-order',
			'interval-merging',
			'stack-matching',
			'monotonic-stack',
			'priority-order',
			'heap-operations',
			'bounded-heaps',
			'link-rewrites',
			'pointer-walks',
			'design-structures',
			'tries'
		]) {
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

describe('shipped curriculum at each depth level', () => {
	const curriculum = loadCurriculum('content/curriculum', 'content/decks');

	it('opens Weighted paths after Traversal layers at every level, and only its deep Dijkstra fork waits on Priority order', () => {
		const weighted = (level: Depth) =>
			projectCurriculum(curriculum, [], level)
				.branches.flatMap((item) => item.paths)
				.find((item) => item.id === 'weighted-paths')!;
		for (const level of DEPTHS) {
			expect(weighted(level).main[0]!.lockedBy.map((item) => item.id), level).toEqual(['traversal-layers']);
			expect(weighted(level).after.map((item) => item.id), level).toEqual(['traversal-layers']);
		}
		expect(weighted('interview').forks).toEqual([]);
		expect(weighted('deep').forks[0]!.skills[0]!.lockedBy.map((item) => item.id)).toEqual(['priority-order']);
		// The interview pool holds 4 exam items, so its sitting is 4.
		expect(weighted('interview').checkpoints[0]!.sitting).toBe(4);
		expect(weighted('deep').checkpoints[0]!.sitting).toBe(EXAM_SIZE);
	});

	const fullPaths = curriculum.branches.flatMap((item) => item.paths);
	const views = new Map(DEPTHS.map((level) => [level, curriculumAt(curriculum, level)]));
	const pathsAt = (level: Depth) => views.get(level)!.branches.flatMap((item) => item.paths);

	describe.each(DEPTHS)('at %s', (level) => {
		const at = views.get(level)!;
		const paths = pathsAt(level);
		const pathIds = new Set(paths.map((item) => item.id));
		const skillIds = new Set(paths.flatMap((item) => item.skills.map((skill) => skill.id)));
		const checkpointIds = new Set(paths.flatMap((item) => item.checkpoints.map((checkpoint) => checkpoint.id)));

		it('gates each checkpoint on visible skills, from a non-empty pool of visible items that covers its mix', () => {
			for (const item of paths) {
				const pools = examDrills(item, at.drills);
				for (const checkpoint of item.checkpoints) {
					for (const id of checkpoint.requires) expect(skillIds.has(id), `${checkpoint.id} requires ${id}`).toBe(true);
					const pool = pools.get(checkpoint.id) ?? [];
					expect(pool.length, checkpoint.id).toBeGreaterThan(0);
					for (const drill of pool) expect(visibleAt(drill.depth, level), drill.questionId).toBe(true);
					for (const kind of checkpoint.mix) expect(pool.some((drill) => drill.covers.includes(kind)), `${checkpoint.id} ${kind}`).toBe(true);
				}
			}
		});

		it('gives every skill at least 3 visible teaching drills', () => {
			for (const item of paths) {
				for (const [skillId, drills] of teachingBySkill(item, at.drills)) expect(drills.length, `${item.id}/${skillId}`).toBeGreaterThanOrEqual(3);
			}
		});

		it('drops no drill its depth shows, so deck filtering by the depth map agrees', () => {
			const byDepth = curriculum.drills.filter((drill) => visibleAt(drill.depth, level)).map((drill) => drill.questionId);
			expect(at.drills.map((drill) => drill.questionId).sort()).toEqual(byDepth.sort());
		});

		it('names no hidden path, skill or checkpoint', () => {
			for (const item of paths) {
				for (const id of item.after) expect(pathIds.has(id), `${item.id} after ${id}`).toBe(true);
				for (const skill of item.skills) for (const id of skill.after) expect(skillIds.has(id), `${skill.id} after ${id}`).toBe(true);
			}
			for (const drill of at.drills) {
				expect(visibleAt(drill.depth, level) && pathIds.has(drill.pathId), drill.questionId).toBe(true);
				for (const id of [drill.skillId, ...(drill.tests ?? [])].filter((value) => value !== undefined)) {
					expect(skillIds.has(id), `${drill.questionId} names ${id}`).toBe(true);
				}
				if (drill.checkpointId) expect(checkpointIds.has(drill.checkpointId), drill.questionId).toBe(true);
			}
		});
	});

	it('keeps every pairing, in order, at the deepest level', () => {
		const deepest = views.get(DEPTHS[DEPTHS.length - 1]!)!;
		const order = (pairs: Map<string, readonly { questionId: string }[]>) => [...pairs].map(([id, drills]) => [id, drills.map((drill) => drill.questionId)]);
		for (const item of fullPaths) {
			expect(order(teachingBySkill(item, deepest.drills)), item.id).toEqual(order(teachingBySkill(item, curriculum.drills)));
			expect(order(examDrills(item, deepest.drills)), item.id).toEqual(order(examDrills(item, curriculum.drills)));
		}
	});

	it('leaves these checkpoints with an interview pool under a full sitting', () => {
		const under = (level: Depth) =>
			pathsAt(level).flatMap((item) => {
				const pools = examDrills(item, views.get(level)!.drills);
				return item.checkpoints.filter((checkpoint) => (pools.get(checkpoint.id)?.length ?? 0) < EXAM_SIZE).map((checkpoint) => checkpoint.id);
			});
		const small = ['repair-boundary-update', 'rotated-search-variant', 'unlink-or-cycle', 'count-blocked-paths'];
		expect(under('deep').sort()).toEqual([...small].sort());
		expect(under('interview').sort()).toEqual([...small, 'meet-stated-costs', 'cheapest-within-stops', 'trace-lcs'].sort());
	});

	it('changes only these checkpoints at interview (#155 plan, section 2)', () => {
		// A deliberate snapshot of the plan's table, so a content change that moves an interview pool is seen.
		// Update it with any change to the exam items or depths of these paths.
		const interview = views.get('interview')!;
		const changed: Record<string, { pool: [number, number]; dropped: string[] }> = {};
		const hidden: string[] = [];
		for (const item of fullPaths) {
			const shown = pathsAt('interview').find((candidate) => candidate.id === item.id);
			const before = examDrills(item, curriculum.drills);
			const after = shown ? examDrills(shown, interview.drills) : new Map();
			for (const checkpoint of item.checkpoints) {
				const visible = shown?.checkpoints.find((candidate) => candidate.id === checkpoint.id);
				if (!visible) {
					hidden.push(checkpoint.id);
					continue;
				}
				expect(visible.mix, checkpoint.id).toEqual(checkpoint.mix);
				const pool: [number, number] = [before.get(checkpoint.id)!.length, after.get(checkpoint.id)!.length];
				const dropped = checkpoint.requires.filter((id) => !visible.requires.includes(id));
				if (pool[0] !== pool[1] || dropped.length > 0) changed[checkpoint.id] = { pool, dropped };
			}
		}
		expect(hidden).toEqual(['trace-and-choose-bits', 'search-with-fallbacks', 'build-minimum-tree', 'validate-or-ancestor']);
		expect(changed).toEqual({
			'meet-stated-costs': { pool: [5, 4], dropped: ['replay-operations'] },
			'components-or-links': { pool: [7, 6], dropped: [] },
			'cheapest-within-stops': { pool: [9, 4], dropped: ['finalize-distance'] },
			'optimal-schedule': { pool: [6, 5], dropped: [] },
			'preserve-valid-outputs': { pool: [7, 6], dropped: [] },
			'trace-lcs': { pool: [7, 4], dropped: [] },
			'choose-a-method': { pool: [7, 6], dropped: ['finalize-distance'] }
		});
	});

	it('builds virtual:depths from every drill deeper than the default', () => {
		expect(depths).toEqual(depthMap(curriculum));
		expect(Object.keys(depths).sort()).toEqual(curriculum.drills.filter((drill) => drill.depth !== DEFAULT_DEPTH).map((drill) => drill.questionId).sort());
		expect(Object.values(depths).every((value) => value !== DEFAULT_DEPTH)).toBe(true);
	});
});

describe('compileCurriculum', () => {
	it('makes the first skill of a fork wait on the skills it needs, and keeps them out of requires', () => {
		const alpha = path('alpha');
		const beta = { ...path('beta', ['alpha']), forks: [{ id: 'side', title: 'Side', after: 'beta-a', needs: ['gamma-b'], levels: [level('side-a')] }] };
		const compiled = compileCurriculum([branch('foundations', 1, [alpha, beta, path('gamma')])], []);
		const compiledBeta = compiled.branches[0]!.paths[1]!;
		expect(compiledBeta.skills.find((skill) => skill.id === 'side-a')!.after).toEqual(['beta-a', 'gamma-b']);
		expect(compiledBeta.skills[0]!.after).toEqual(['alpha-b']);
		expect(compiledBeta.checkpoints[0]!.requires).toEqual(['beta-a', 'beta-b', 'side-a']);
	});

	it('rejects a fork that needs an unknown skill, a skill on its own path, or one skill twice', () => {
		const withNeeds = (needs: string[]) => [
			branch('foundations', 1, [path('alpha'), { ...path('beta'), forks: [{ id: 'side', title: 'Side', needs, levels: [level('side-a')] }] }])
		];
		expect(() => compileCurriculum(withNeeds(['nope']), [])).toThrow('fork "side" needs "nope", which is not a skill');
		expect(() => compileCurriculum(withNeeds(['beta-a']), [])).toThrow('fork "side" needs "beta-a", which is on its own path');
		expect(() => compileCurriculum(withNeeds(['alpha-b', 'alpha-b']), [])).toThrow('fork "side" lists a needed skill twice');
	});

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

	function deepPath(id: string): BranchFile['paths'][number] {
		const deep = path(id);
		deep.depth = 'deep';
		return deep;
	}

	it('resolves an unset depth to its parent, interview at the top, and keeps an explicit deep', () => {
		const shallow = path('shallow');
		shallow.levels = [shallow.levels[0]!, { ...shallow.levels[1]!, depth: 'deep' }];
		shallow.forks = [{ id: 'side', title: 'Side', levels: [{ ...level('side-a'), depth: 'deep' }] }];
		const files = [
			branch('foundations', 1, [shallow, deepPath('deep')], [
				{ questionId: 'plain', disposition: 'keep', path: 'shallow', skill: 'shallow-a', note: 'Default.' },
				{ questionId: 'deep-card', disposition: 'keep', path: 'shallow', skill: 'shallow-b', note: 'Deep skill.' },
				{ questionId: 'deep-exam', disposition: 'exam', path: 'deep', note: 'Deep path.' }
			])
		];
		const compiled = compileCurriculum(files, questions('plain', 'deep-card', 'deep-exam'));
		const [interviewPath, deep] = compiled.branches[0]!.paths;
		expect(interviewPath!.depth).toBe('interview');
		expect(interviewPath!.skills.map((skill) => [skill.id, skill.depth])).toEqual([
			['shallow-a', 'interview'],
			['shallow-b', 'deep'],
			['side-a', 'deep']
		]);
		expect(deep!.depth).toBe('deep');
		expect(deep!.skills.map((skill) => skill.depth)).toEqual(['deep', 'deep']);
		expect(compiled.drills.map((drill) => drill.depth)).toEqual(['interview', 'deep', 'deep']);
	});

	it('rejects a skill shallower than its path', () => {
		const main = deepPath('alpha');
		main.levels = [main.levels[0]!, { ...level('alpha-b'), depth: 'interview' }];
		expect(() => compileCurriculum([branch('foundations', 1, [main])], [])).toThrow(
			'skill "alpha-b" is interview, shallower than its path "alpha" (deep)'
		);
		const forked = deepPath('alpha');
		forked.forks = [{ id: 'side', title: 'Side', levels: [{ ...level('side-a'), depth: 'interview' }] }];
		expect(() => compileCurriculum([branch('foundations', 1, [forked])], [])).toThrow(
			'skill "side-a" is interview, shallower than its path "alpha" (deep)'
		);
	});

	it('rejects a drill shallower than the skill it names, or its path when it names none', () => {
		const alpha = path('alpha');
		alpha.levels = [alpha.levels[0]!, { ...alpha.levels[1]!, depth: 'deep' }];
		const underSkill = [
			branch('foundations', 1, [alpha], [{ questionId: 'one', disposition: 'keep', path: 'alpha', skill: 'alpha-b', depth: 'interview', note: 'Teach it.' }])
		];
		expect(() => compileCurriculum(underSkill, questions('one'))).toThrow(
			'drill "one" is interview, shallower than its skill "alpha-b" (deep)'
		);
		const underPath = [branch('foundations', 1, [deepPath('beta')], [{ questionId: 'one', disposition: 'exam', path: 'beta', depth: 'interview', note: 'Exam.' }])];
		expect(() => compileCurriculum(underPath, questions('one'))).toThrow(
			'drill "one" is interview, shallower than its path "beta" (deep)'
		);
	});

	it('rejects an exam drill shallower than a skill it tests', () => {
		const alpha = path('alpha');
		alpha.levels = [alpha.levels[0]!, { ...alpha.levels[1]!, depth: 'deep' }];
		const files = [
			branch('foundations', 1, [alpha], [{ questionId: 'one', disposition: 'exam', path: 'alpha', tests: ['alpha-b'], note: 'Exam.' }])
		];
		expect(() => compileCurriculum(files, questions('one'))).toThrow(
			'drill "one" is interview, shallower than the skill it tests, "alpha-b" (deep)'
		);
	});

	it('makes an exam drill list the skills it tests when the path holds deeper skills', () => {
		const alpha = path('alpha');
		alpha.levels = [alpha.levels[0]!, { ...alpha.levels[1]!, depth: 'deep' }];
		const files = [branch('foundations', 1, [alpha], [{ questionId: 'one', disposition: 'exam', path: 'alpha', note: 'Exam.' }])];
		expect(() => compileCurriculum(files, questions('one'))).toThrow(
			'drill "one" must list the skills it tests, because path "alpha" has skills deeper than the drill'
		);
		const named = [branch('foundations', 1, [alpha], [{ questionId: 'one', disposition: 'exam', path: 'alpha', tests: ['alpha-a'], note: 'Exam.' }])];
		expect(() => compileCurriculum(named, questions('one'))).not.toThrow();
	});

	it('rejects a skill that requires a deeper skill', () => {
		const files = [branch('foundations', 1, [deepPath('alpha'), path('beta', ['alpha'])])];
		expect(() => compileCurriculum(files, [])).toThrow(
			'skill "beta-a" is interview, shallower than the skill it requires, "alpha-b" (deep)'
		);
	});

	it('makes a teaching drill name its skill when the path holds skills at another depth', () => {
		const alpha = path('alpha');
		alpha.levels = [alpha.levels[0]!, { ...alpha.levels[1]!, depth: 'deep' }];
		const files = [branch('foundations', 1, [alpha], [{ questionId: 'one', disposition: 'keep', path: 'alpha', note: 'Teach it.' }])];
		expect(() => compileCurriculum(files, questions('one'))).toThrow(
			'drill "one" must name its skill, because path "alpha" has skills at another depth'
		);
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

	it('names the item when a depth is not one of the levels', () => {
		const dir = mkdtempSync(join(tmpdir(), 'curriculum-'));
		const decks = mkdtempSync(join(tmpdir(), 'decks-'));
		scratch.push(dir, decks);
		writeFileSync(
			join(dir, 'foundations.yaml'),
			`id: foundations\ntitle: Foundations\nsummary: Shared.\norder: 1\npaths:\n  - id: arrays\n    title: Arrays\n    summary: Read.\n    after: []\n    levels:\n      - { id: a, title: A }\n      - { id: b, title: B, depth: shallow }\n    checkpoints:\n      - { id: exam, title: Exam, summary: Combine. }\ndrills: []\n`
		);
		expect(() => loadCurriculum(dir, decks)).toThrow(/paths\.0\.levels\.1\.depth/);
	});
});
