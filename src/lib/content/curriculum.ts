import { z } from 'zod';
import { ContentError } from './contentError.ts';
import { DEFAULT_DEPTH, DEPTHS, type Depth } from './depth.ts';

export { DEFAULT_LEVEL, DEPTHS, visibleAt, type Depth } from './depth.ts';

/**
 * The mastery curriculum compiled from `content/curriculum/*.yaml`.
 *
 * A path is a short sequence of skills (two to `MAX_PATH_SKILLS` levels) plus any fork,
 * ending in one or two checkpoints. `after` names the paths that must come
 * first. A checkpoint's `requires` list is every skill that gates that exam:
 * the skills on the path that it synthesizes, every skill of each path in
 * `after` when more than one path leads in, and any extra skill named in
 * `needs` (a prerequisite the plan names that is not itself a path).
 *
 * An exam stays locked until every id in `requires` is mastered. One path
 * can move while another path that also leads into the exam has not.
 *
 * A path's members are skills and checkpoints (`PathNodeKind`). A lesson
 * activity (#18), or a quiz if #20 keeps quizzes as tree nodes, would be
 * another kind on the path. It would not be an edge and would not belong in
 * `requires`. Spaced review (#19) is not a kind: it lives outside the tree
 * and only changes which skills count as mastered.
 */

const id = z
	.string()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'use lowercase kebab-case (letters, digits, hyphens)');

const text = (max: number) => z.string().trim().min(1).max(max);

const depth = z.enum(DEPTHS).optional();

const shallower = (item: Depth, than: Depth): boolean => DEPTHS.indexOf(item) < DEPTHS.indexOf(than);

/** A learner who chose a level must never meet an item that depends on something above it. */
function assertNotShallower(item: string, depth: Depth, relation: string, other: string, otherDepth: Depth): void {
	if (shallower(depth, otherDepth)) throw new ContentError(`${item} is ${depth}, shallower than ${relation} ${other} (${otherDepth})`);
}

const levelSchema = z
	.object({
		id,
		title: text(90),
		/** Never shallower than the path. */
		depth
	})
	.strict();

const forkSchema = z
	.object({
		id,
		title: text(80),
		/** Main-line skill this fork splits from. Omit to split at the path entrance. */
		after: id.optional(),
		/**
		 * Skills on other paths that only this fork builds on: its first skill waits on them too.
		 * Unlike a path's `needs`, they stay out of the checkpoint's `requires`, so a level that
		 * hides the fork hides the prerequisite with it (#155).
		 */
		needs: z.array(id).optional(),
		levels: z.array(levelSchema).min(1).max(4)
	})
	.strict();

const checkpointSchema = z
	.object({
		id,
		title: text(90),
		summary: text(240),
		/**
		 * Path skill ids that this exam synthesizes. Required when the path has
		 * two checkpoints. Omit it when the path has one: that exam uses every
		 * skill on the path.
		 */
		requires: z.array(id).min(1).optional(),
		/**
		 * Kinds of item every exam built from this checkpoint must include. Each
		 * kind needs an exam drill on the path that lists it in `covers`. Only a
		 * path with one checkpoint can use it, because exam drills are not yet
		 * assigned to a checkpoint by name.
		 */
		mix: z.array(id).min(1).optional()
	})
	.strict();

export const DISPOSITIONS = ['keep', 'rewrite', 'exam', 'retire'] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

const drillSchema = z
	.object({
		questionId: id,
		disposition: z.enum(DISPOSITIONS),
		path: id,
		/**
		 * Keep and rewrite drills only: the skill on `path` this drill teaches.
		 * Without it, mastery pairs the drill with a skill by list position.
		 */
		skill: id.optional(),
		/** A fresh example that can substitute for a due drill of the named skill. */
		variant: z.literal(true).optional(),
		/**
		 * Exam drills only: the skills on `path` this item checks. A failed sitting sends the
		 * learner to review those skills. Without it, the checkpoint's whole path is reviewed.
		 */
		tests: z.array(id).min(1).optional(),
		/**
		 * Exam drills only: the checkpoint on `path` this item belongs to. A path with two
		 * checkpoints needs it, or the drills are paired with them by list position.
		 */
		checkpoint: id.optional(),
		/** Exam drills only: the checkpoint `mix` kinds this item counts toward. */
		covers: z.array(id).min(1).optional(),
		/** Never shallower than the named skill, or the path when no skill is named. */
		depth,
		note: text(400)
	})
	.strict();

const followUpSchema = z
	.object({
		questionId: id,
		optionId: id,
		disposition: z.enum(DISPOSITIONS),
		path: id,
		note: text(400)
	})
	.strict();

/** The most skills a path's main line holds, so its checkpoint comes after a short run of skills (#9, raised from 3 for #154). */
export const MAX_PATH_SKILLS = 4;

export const branchSchema = z
	.object({
		id,
		title: text(60),
		summary: text(300),
		/** Display order. 1 is the first branch. */
		order: z.number().int().positive(),
		paths: z.array(
			z
				.object({
					id,
					title: text(60),
					summary: text(300),
					/** Path ids that come before this one. Empty means a root. */
					after: z.array(id),
					/** Plan text that does not name a path, so it is not an edge. */
					afterNote: text(300).optional(),
					depth,
					/** Extra skill ids the entrance and the single checkpoint wait on. */
					needs: z.array(id).optional(),
					levels: z.array(levelSchema).min(2).max(MAX_PATH_SKILLS),
					forks: z.array(forkSchema).max(2).optional(),
					checkpoints: z.array(checkpointSchema).min(1).max(2)
				})
				.strict()
		).min(1),
		drills: z.array(drillSchema),
		followUps: z.array(followUpSchema).optional()
	})
	.strict();

export type BranchFile = z.infer<typeof branchSchema>;

export interface SourceQuestion {
	deckId: string;
	questionId: string;
	/** Wrong-option ids, which are the follow-up keys. */
	followUpIds: readonly string[];
}

/** Kinds a path contains today. Extend this when a path grows a new member. */
export type PathNodeKind = 'skill' | 'checkpoint';

export interface CurriculumSkill {
	kind: 'skill';
	id: string;
	title: string;
	pathId: string;
	branchId: string;
	/** `main`, or the id of the fork this skill is on. */
	line: string;
	/** Skill ids that come immediately before this one. */
	after: readonly string[];
	depth: Depth;
}

export interface CurriculumCheckpoint {
	kind: 'checkpoint';
	id: string;
	title: string;
	summary: string;
	pathId: string;
	branchId: string;
	/** Every skill that gates this exam, in teaching order. */
	requires: readonly string[];
	/** Item kinds every exam must include. Empty when the checkpoint sets none. */
	mix: readonly string[];
}

export interface CurriculumFork {
	id: string;
	title: string;
	/** Main skill the fork splits from, or null when it splits at the entrance. */
	after: string | null;
	skillIds: readonly string[];
}

export interface CurriculumPath {
	id: string;
	title: string;
	summary: string;
	branchId: string;
	after: readonly string[];
	afterNote?: string;
	depth: Depth;
	skills: readonly CurriculumSkill[];
	forks: readonly CurriculumFork[];
	checkpoints: readonly CurriculumCheckpoint[];
}

export interface CurriculumBranch {
	id: string;
	title: string;
	summary: string;
	order: number;
	paths: readonly CurriculumPath[];
}

export interface CurriculumDrill {
	questionId: string;
	deckId: string;
	disposition: Disposition;
	pathId: string;
	/** The skill this drill teaches, when the mapping names one. */
	skillId?: string;
	variant?: true;
	/** For an exam drill: the skills it checks, when the mapping names them. */
	tests?: readonly string[];
	/** For an exam drill: the checkpoint it belongs to, when the mapping names one. */
	checkpointId?: string;
	/** Item kinds this exam drill counts toward. Empty for other dispositions. */
	covers: readonly string[];
	depth: Depth;
	note: string;
}

export interface CurriculumFollowUp {
	questionId: string;
	optionId: string;
	deckId: string;
	disposition: Disposition;
	pathId: string;
	note: string;
}

export interface Curriculum {
	branches: readonly CurriculumBranch[];
	drills: readonly CurriculumDrill[];
	followUps: readonly CurriculumFollowUp[];
}

function dedupe(ids: readonly string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const id of ids) {
		if (seen.has(id)) continue;
		seen.add(id);
		out.push(id);
	}
	return out;
}

function cycle(edges: ReadonlyMap<string, readonly string[]>): string[] | null {
	const state = new Map<string, 'visiting' | 'done'>();
	const stack: string[] = [];
	function visit(node: string): string[] | null {
		const mark = state.get(node);
		if (mark === 'done') return null;
		if (mark === 'visiting') return [...stack.slice(stack.indexOf(node)), node];
		state.set(node, 'visiting');
		stack.push(node);
		for (const next of edges.get(node) ?? []) {
			const found = visit(next);
			if (found) return found;
		}
		stack.pop();
		state.set(node, 'done');
		return null;
	}
	for (const node of edges.keys()) {
		const found = visit(node);
		if (found) return found;
	}
	return null;
}

/**
 * Checks the branch files against the decks and expands checkpoint gates.
 * Throws `ContentError` on the first problem. Question ids must be unique
 * across decks; every one of them is mapped by exactly one drill.
 */
export function compileCurriculum(files: readonly BranchFile[], questions: readonly SourceQuestion[]): Curriculum {
	const branches = [...files].sort((a, b) => a.order - b.order);
	const seenIds = new Map<string, string>();

	function claim(id: string, kind: string): void {
		const previous = seenIds.get(id);
		if (previous) throw new ContentError(`id "${id}" is used as ${previous} and as ${kind}`);
		seenIds.set(id, kind);
	}

	branches.forEach((branch, index) => {
		claim(branch.id, 'a branch');
		if (branch.order !== index + 1) {
			throw new ContentError(`branch "${branch.id}" has order ${branch.order}; expected ${index + 1}`);
		}
	});

	const questionsById = new Map<string, SourceQuestion>();
	for (const question of questions) {
		if (questionsById.has(question.questionId)) {
			throw new ContentError(`question id "${question.questionId}" appears in more than one deck`);
		}
		questionsById.set(question.questionId, question);
	}

	const pathBranch = new Map<string, BranchFile>();
	const pathFile = new Map<string, BranchFile['paths'][number]>();
	for (const branch of branches) {
		for (const path of branch.paths) {
			claim(path.id, 'a path');
			if (pathBranch.has(path.id)) throw new ContentError(`duplicate path id "${path.id}"`);
			pathBranch.set(path.id, branch);
			pathFile.set(path.id, path);
		}
	}

	const pathEdges = new Map<string, readonly string[]>();
	for (const path of pathFile.values()) {
		const after = dedupe(path.after);
		if (after.length !== path.after.length) {
			throw new ContentError(`path "${path.id}" lists a prerequisite twice`);
		}
		for (const prerequisite of after) {
			if (prerequisite === path.id) throw new ContentError(`path "${path.id}" cannot come after itself`);
			if (!pathFile.has(prerequisite)) {
				throw new ContentError(`path "${path.id}" comes after "${prerequisite}", which is not a path`);
			}
		}
		pathEdges.set(path.id, after);
	}
	const pathCycle = cycle(pathEdges);
	if (pathCycle) throw new ContentError(`paths form a cycle: ${pathCycle.join(' → ')}`);

	const lastMain = new Map<string, string>();

	for (const [pathId, path] of pathFile) {
		const mainIds = path.levels.map((level) => level.id);
		const mainSet = new Set(mainIds);
		if (mainSet.size !== mainIds.length) throw new ContentError(`path "${pathId}" repeats a skill id`);
		for (const level of path.levels) claim(level.id, 'a skill');

		for (const fork of path.forks ?? []) {
			claim(fork.id, 'a fork');
			if (fork.after && !mainSet.has(fork.after)) {
				throw new ContentError(
					`path "${pathId}": fork "${fork.id}" splits from "${fork.after}", which is not a main skill of this path`
				);
			}
			const forkIds = fork.levels.map((level) => level.id);
			if (new Set(forkIds).size !== forkIds.length) {
				throw new ContentError(`fork "${fork.id}" repeats a skill id`);
			}
			for (const level of fork.levels) claim(level.id, 'a skill');
			if (dedupe(fork.needs ?? []).length !== (fork.needs?.length ?? 0)) {
				throw new ContentError(`fork "${fork.id}" lists a needed skill twice`);
			}
		}

		if ((path.needs?.length ?? 0) > 0 && path.checkpoints.length > 1) {
			throw new ContentError(
				`path "${pathId}": a path with two checkpoints cannot use needs; name those skills on each checkpoint`
			);
		}
		const needs = dedupe(path.needs ?? []);
		if (needs.length !== (path.needs?.length ?? 0)) {
			throw new ContentError(`path "${pathId}" lists a needed skill twice`);
		}
		const ownSkillIds = new Set([...mainIds, ...(path.forks ?? []).flatMap((fork) => fork.levels.map((level) => level.id))]);
		for (const needed of needs) {
			if (ownSkillIds.has(needed)) {
				throw new ContentError(`path "${pathId}" needs "${needed}", which is already on this path`);
			}
		}

		lastMain.set(pathId, mainIds[mainIds.length - 1]!);
	}

	// Every path's last main skill now exists, so entrance edges can point at them
	// even when a path comes after one that is listed later in the files.
	const skillIndex = new Map<string, CurriculumSkill>();
	const skillsByPath = new Map<string, CurriculumSkill[]>();
	for (const [pathId, path] of pathFile) {
		const branch = pathBranch.get(pathId)!;
		const needs = dedupe(path.needs ?? []);
		const entrance = [...path.after.map((prerequisite) => lastMain.get(prerequisite)!), ...needs];
		const skills: CurriculumSkill[] = [];
		const pathDepth = path.depth ?? DEFAULT_DEPTH;
		path.levels.forEach((level, index) => {
			const skill: CurriculumSkill = {
				kind: 'skill',
				id: level.id,
				title: level.title,
				pathId,
				branchId: branch.id,
				line: 'main',
				after: index === 0 ? [...entrance] : [path.levels[index - 1]!.id],
				depth: level.depth ?? pathDepth
			};
			skills.push(skill);
			skillIndex.set(skill.id, skill);
		});
		for (const fork of path.forks ?? []) {
			fork.levels.forEach((level, index) => {
				const skill: CurriculumSkill = {
					kind: 'skill',
					id: level.id,
					title: level.title,
					pathId,
					branchId: branch.id,
					line: fork.id,
					after: index === 0 ? dedupe([...(fork.after ? [fork.after] : entrance), ...(fork.needs ?? [])]) : [fork.levels[index - 1]!.id],
					depth: level.depth ?? pathDepth
				};
				skills.push(skill);
				skillIndex.set(skill.id, skill);
			});
		}
		for (const skill of skills) assertNotShallower(`skill "${skill.id}"`, skill.depth, 'its path', `"${pathId}"`, pathDepth);
		skillsByPath.set(pathId, skills);
	}

	for (const [pathId, path] of pathFile) {
		for (const needed of dedupe(path.needs ?? [])) {
			if (!skillIndex.has(needed)) {
				throw new ContentError(`path "${pathId}" needs "${needed}", which is not a skill`);
			}
		}
		for (const fork of path.forks ?? []) {
			for (const needed of fork.needs ?? []) {
				if (!skillIndex.has(needed)) throw new ContentError(`fork "${fork.id}" needs "${needed}", which is not a skill`);
				if (skillIndex.get(needed)!.pathId === pathId) {
					throw new ContentError(`fork "${fork.id}" needs "${needed}", which is on its own path; use the fork's after`);
				}
			}
		}
	}

	const skillEdges = new Map<string, readonly string[]>([...skillIndex].map(([id, skill]) => [id, skill.after]));
	const skillCycle = cycle(skillEdges);
	if (skillCycle) throw new ContentError(`skills form a cycle: ${skillCycle.join(' → ')}`);
	for (const skill of skillIndex.values()) {
		for (const required of skill.after) {
			assertNotShallower(`skill "${skill.id}"`, skill.depth, 'the skill it requires,', `"${required}"`, skillIndex.get(required)!.depth);
		}
	}

	const compiledPaths = new Map<string, CurriculumPath>();
	for (const [pathId, path] of pathFile) {
		const branch = pathBranch.get(pathId)!;
		const skills = skillsByPath.get(pathId)!;
		const ownIds = skills.map((skill) => skill.id);
		const ownSet = new Set(ownIds);
		const needs = dedupe(path.needs ?? []);

		let checkpoints: CurriculumCheckpoint[];
		if (path.checkpoints.length === 1) {
			const checkpoint = path.checkpoints[0]!;
			if (checkpoint.requires) {
				throw new ContentError(
					`path "${pathId}": the only checkpoint covers every skill on the path; remove requires`
				);
			}
			claim(checkpoint.id, 'a checkpoint');
			const fromPaths =
				path.after.length > 1 ? path.after.flatMap((prerequisite) => skillsByPath.get(prerequisite)!.map((skill) => skill.id)) : [];
			checkpoints = [
				{
					kind: 'checkpoint',
					id: checkpoint.id,
					title: checkpoint.title,
					summary: checkpoint.summary,
					pathId,
					branchId: branch.id,
					requires: dedupe([...ownIds, ...fromPaths, ...needs]),
					mix: dedupe(checkpoint.mix ?? [])
				}
			];
		} else {
			const covered = new Set<string>();
			checkpoints = path.checkpoints.map((checkpoint) => {
				if (!checkpoint.requires) {
					throw new ContentError(`path "${pathId}": checkpoint "${checkpoint.id}" must list requires`);
				}
				if (checkpoint.mix) {
					throw new ContentError(
						`path "${pathId}": checkpoint "${checkpoint.id}" sets mix, which needs a path with one checkpoint`
					);
				}
				claim(checkpoint.id, 'a checkpoint');
				for (const required of checkpoint.requires) {
					if (!ownSet.has(required)) {
						throw new ContentError(
							`path "${pathId}": checkpoint "${checkpoint.id}" requires "${required}", which is not a skill on this path`
						);
					}
					if (covered.has(required)) {
						throw new ContentError(`path "${pathId}": "${required}" is required by two checkpoints`);
					}
					covered.add(required);
				}
				return {
					kind: 'checkpoint',
					id: checkpoint.id,
					title: checkpoint.title,
					summary: checkpoint.summary,
					pathId,
					branchId: branch.id,
					requires: dedupe(checkpoint.requires),
					mix: []
				};
			});
			for (const skillId of ownIds) {
				if (!covered.has(skillId)) {
					throw new ContentError(`path "${pathId}": skill "${skillId}" does not gate either checkpoint`);
				}
			}
		}

		for (const checkpoint of checkpoints) {
			if (checkpoint.requires.length === 0) {
				throw new ContentError(`checkpoint "${checkpoint.id}" does not name a skill`);
			}
		}

		compiledPaths.set(pathId, {
			id: pathId,
			title: path.title,
			summary: path.summary,
			branchId: branch.id,
			after: path.after,
			...(path.afterNote ? { afterNote: path.afterNote } : {}),
			depth: path.depth ?? DEFAULT_DEPTH,
			skills,
			forks: (path.forks ?? []).map((fork) => ({
				id: fork.id,
				title: fork.title,
				after: fork.after ?? null,
				skillIds: fork.levels.map((level) => level.id)
			})),
			checkpoints
		});
	}

	const drills: CurriculumDrill[] = [];
	const mapped = new Map<string, string>();
	for (const branch of branches) {
		const pathsHere = new Set(branch.paths.map((path) => path.id));
		for (const drill of branch.drills) {
			if (!pathsHere.has(drill.path)) {
				throw new ContentError(
					`branch "${branch.id}": drill "${drill.questionId}" names path "${drill.path}", which is not in this branch`
				);
			}
			if (mapped.has(drill.questionId)) {
				throw new ContentError(`question "${drill.questionId}" is mapped more than once`);
			}
			const source = questionsById.get(drill.questionId);
			if (!source) throw new ContentError(`drill "${drill.questionId}" is not a question id in content/decks`);
			if (drill.covers && drill.disposition !== 'exam') {
				throw new ContentError(`drill "${drill.questionId}" sets covers, which only an exam drill can do`);
			}
			if (drill.checkpoint) {
				if (drill.disposition !== 'exam') {
					throw new ContentError(`drill "${drill.questionId}" sets checkpoint, which only an exam drill can do`);
				}
				if (!compiledPaths.get(drill.path)!.checkpoints.some((item) => item.id === drill.checkpoint)) {
					throw new ContentError(`drill "${drill.questionId}" names checkpoint "${drill.checkpoint}", which is not on path "${drill.path}"`);
				}
			}
			if (drill.tests) {
				if (drill.disposition !== 'exam') {
					throw new ContentError(`drill "${drill.questionId}" sets tests, which only an exam drill can do`);
				}
				const own = new Set(compiledPaths.get(drill.path)!.skills.map((skill) => skill.id));
				for (const tested of drill.tests) {
					if (!own.has(tested)) {
						throw new ContentError(`drill "${drill.questionId}" tests skill "${tested}", which is not on path "${drill.path}"`);
					}
				}
			}
			if (drill.variant && (!drill.skill || drill.disposition !== 'keep')) {
				throw new ContentError(`drill "${drill.questionId}" sets variant, which requires a keep drill with a skill`);
			}
			if (drill.skill) {
				if (drill.disposition !== 'keep' && drill.disposition !== 'rewrite') {
					throw new ContentError(`drill "${drill.questionId}" sets skill, which only a keep or rewrite drill can do`);
				}
				if (!compiledPaths.get(drill.path)!.skills.some((skill) => skill.id === drill.skill)) {
					throw new ContentError(`drill "${drill.questionId}" names skill "${drill.skill}", which is not on path "${drill.path}"`);
				}
			}
			const drillPath = compiledPaths.get(drill.path)!;
			const skillDepth = (skillId: string) => drillPath.skills.find((skill) => skill.id === skillId)!.depth;
			// Mastery pairs a drill that names no skill with one by list position, which the depth check cannot follow.
			if (!drill.skill && (drill.disposition === 'keep' || drill.disposition === 'rewrite') && drillPath.skills.some((skill) => skill.depth !== drillPath.depth)) {
				throw new ContentError(`drill "${drill.questionId}" must name its skill, because path "${drill.path}" has skills at another depth`);
			}
			const parent = drill.skill
				? { kind: 'skill', id: drill.skill, depth: skillDepth(drill.skill) }
				: { kind: 'path', id: drill.path, depth: drillPath.depth };
			const drillDepth = drill.depth ?? parent.depth;
			const item = `drill "${drill.questionId}"`;
			assertNotShallower(item, drillDepth, `its ${parent.kind}`, `"${parent.id}"`, parent.depth);
			for (const tested of drill.tests ?? []) assertNotShallower(item, drillDepth, 'the skill it tests,', `"${tested}"`, skillDepth(tested));
			// A missed exam drill with no tests sends the learner back to every skill on the path.
			if (drill.disposition === 'exam' && !drill.tests?.length && drillPath.skills.some((skill) => shallower(drillDepth, skill.depth))) {
				throw new ContentError(`${item} must list the skills it tests, because path "${drill.path}" has skills deeper than the drill`);
			}
			mapped.set(drill.questionId, branch.id);
			drills.push({
				questionId: drill.questionId,
				deckId: source.deckId,
				disposition: drill.disposition,
				pathId: drill.path,
				...(drill.skill ? { skillId: drill.skill } : {}),
				...(drill.variant ? { variant: drill.variant } : {}),
				...(drill.tests ? { tests: dedupe(drill.tests) } : {}),
				...(drill.checkpoint ? { checkpointId: drill.checkpoint } : {}),
				covers: dedupe(drill.covers ?? []),
				depth: drillDepth,
				note: drill.note
			});
		}
	}
	for (const path of compiledPaths.values()) {
		const covered = new Set(
			drills.filter((drill) => drill.pathId === path.id && drill.disposition === 'exam').flatMap((drill) => drill.covers)
		);
		for (const kind of path.checkpoints.flatMap((checkpoint) => checkpoint.mix)) {
			if (!covered.has(kind)) {
				throw new ContentError(`path "${path.id}": no exam drill covers "${kind}", which its checkpoint's mix requires`);
			}
		}
	}
	for (const questionId of questionsById.keys()) {
		if (!mapped.has(questionId)) throw new ContentError(`question "${questionId}" is not mapped to a skill path`);
	}

	const followUps: CurriculumFollowUp[] = [];
	const seenFollowUps = new Set<string>();
	for (const branch of branches) {
		for (const followUp of branch.followUps ?? []) {
			const key = `${followUp.questionId}/${followUp.optionId}`;
			if (seenFollowUps.has(key)) throw new ContentError(`follow-up "${key}" is overridden more than once`);
			seenFollowUps.add(key);
			const source = questionsById.get(followUp.questionId);
			if (!source) {
				throw new ContentError(`follow-up "${key}" names a question that is not in content/decks`);
			}
			if (!source.followUpIds.includes(followUp.optionId)) {
				throw new ContentError(`follow-up "${key}" is not a follow-up of that question`);
			}
			if (!pathFile.has(followUp.path)) {
				throw new ContentError(`follow-up "${key}" names path "${followUp.path}", which is not a path`);
			}
			followUps.push({
				questionId: followUp.questionId,
				optionId: followUp.optionId,
				deckId: source.deckId,
				disposition: followUp.disposition,
				pathId: followUp.path,
				note: followUp.note
			});
		}
	}

	return {
		branches: branches.map((branch) => ({
			id: branch.id,
			title: branch.title,
			summary: branch.summary,
			order: branch.order,
			paths: branch.paths.map((path) => compiledPaths.get(path.id)!)
		})),
		drills,
		followUps
	};
}

/** The branch a deck's drills belong to, for the screen's accent. Null when no drill maps the deck. */
export function branchOfDeck(curriculum: Curriculum, deckId: string): string | null {
	const pathId = curriculum.drills.find((drill) => drill.deckId === deckId)?.pathId;
	if (!pathId) return null;
	for (const branch of curriculum.branches) {
		if (branch.paths.some((path) => path.id === pathId)) return branch.id;
	}
	return null;
}
