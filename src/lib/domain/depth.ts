import type { Curriculum, CurriculumCheckpoint, CurriculumDrill, CurriculumPath } from '$lib/content/curriculum';
import { DEFAULT_DEPTH, DEPTHS, visibleAt, type Depth, type DepthMap } from '$lib/content/depth';
import type { Attempt } from '$lib/storage/types';
import { examPassed } from './exam';
import { examDrills, teachingBySkill } from './mastery';

/**
 * The curriculum and decks a learner sees at a depth level (#155). Pure: the
 * level is an argument, nothing is stored, and a level change recomputes
 * everything on the next read.
 */

/**
 * Every teaching drill with the skill it is paired with, and every exam drill
 * with its checkpoint, as the full curriculum pairs them. Pairing by list
 * position counts only drills that name nothing, so without this, dropping a
 * deeper unnamed drill would move the drills after it onto other skills.
 *
 * Pairing lists a skill's or checkpoint's unnamed drills before its named ones.
 * Once every drill names one, list order decides, so each path's unnamed
 * teaching (and exam) drills move ahead of its named ones, within the places
 * those drills held. Every pairing then keeps its order, but the drill list
 * itself can change order, so read list-order lookups such as `branchOfDeck`
 * from the full curriculum.
 */
function pinned(curriculum: Curriculum): CurriculumDrill[] {
	const skillOf = new Map<CurriculumDrill, string>();
	const checkpointOf = new Map<CurriculumDrill, string>();
	for (const branch of curriculum.branches) {
		for (const path of branch.paths) {
			for (const [skillId, drills] of teachingBySkill(path, curriculum.drills)) for (const drill of drills) skillOf.set(drill, skillId);
			for (const [checkpointId, drills] of examDrills(path, curriculum.drills)) for (const drill of drills) checkpointOf.set(drill, checkpointId);
		}
	}
	const named = (drill: CurriculumDrill) => drill.skillId !== undefined || drill.checkpointId !== undefined;
	const groups = new Map<string, number[]>();
	curriculum.drills.forEach((drill, index) => {
		const group = skillOf.has(drill) ? 'teaching' : checkpointOf.has(drill) ? 'exam' : null;
		if (!group) return;
		const key = `${drill.pathId}/${group}`;
		const places = groups.get(key) ?? [];
		places.push(index);
		groups.set(key, places);
	});
	const order = curriculum.drills.map((_, index) => index);
	for (const places of groups.values()) {
		const sorted = [...places.filter((index) => !named(curriculum.drills[index]!)), ...places.filter((index) => named(curriculum.drills[index]!))];
		places.forEach((place, k) => (order[place] = sorted[k]!));
	}
	return order.map((index) => {
		const drill = curriculum.drills[index]!;
		const skillId = drill.skillId ?? skillOf.get(drill);
		const checkpointId = drill.checkpointId ?? checkpointOf.get(drill);
		return {
			...drill,
			...(skillId ? { skillId } : {}),
			...(checkpointId ? { checkpointId } : {})
		};
	});
}

function skillDepths(curriculum: Curriculum): Map<string, Depth> {
	return new Map(curriculum.branches.flatMap((branch) => branch.paths.flatMap((path) => path.skills.map((skill) => [skill.id, skill.depth] as const))));
}

/**
 * A checkpoint at `level`, from its full (pinned) pool: `requires` keeps the
 * visible skills, the pool keeps the visible drills, and `mix` keeps the kinds
 * that pool still covers. Null when no required skill is visible.
 */
function checkpointAt(
	checkpoint: CurriculumCheckpoint,
	pool: readonly CurriculumDrill[],
	depthOfSkill: ReadonlyMap<string, Depth>,
	level: Depth
): { checkpoint: CurriculumCheckpoint; pool: CurriculumDrill[] } | null {
	const requires = checkpoint.requires.filter((id) => visibleAt(depthOfSkill.get(id) ?? DEFAULT_DEPTH, level));
	if (requires.length === 0) return null;
	const shown = pool.filter((drill) => visibleAt(drill.depth, level));
	const covered = new Set(shown.flatMap((drill) => drill.covers));
	return { checkpoint: { ...checkpoint, requires, mix: checkpoint.mix.filter((kind) => covered.has(kind)) }, pool: shown };
}

/**
 * The curriculum a learner at `level` sees. Drills are pinned to their skill
 * and checkpoint first, then paths, skills, forks, drills, follow-up overrides
 * and checkpoints deeper than `level` are dropped, with every reference to them
 * (`after` lists, `requires`, `mix` kinds no visible pool drill covers). A path
 * with no visible skill, and a fork or branch left empty, go too. At the
 * deepest level the result is the input with pinned ids (and unnamed drills
 * ahead of named ones within a path, as `pinned` explains).
 */
export function curriculumAt(curriculum: Curriculum, level: Depth): Curriculum {
	const drills = pinned(curriculum);
	const depthOfSkill = skillDepths(curriculum);
	const skillShown = (id: string) => visibleAt(depthOfSkill.get(id) ?? DEFAULT_DEPTH, level);
	const pathShown = new Set(
		curriculum.branches.flatMap((branch) =>
			branch.paths.filter((path) => visibleAt(path.depth, level) && path.skills.some((skill) => skillShown(skill.id))).map((path) => path.id)
		)
	);
	const checkpointShown = new Set<string>();

	function pathAt(path: CurriculumPath): CurriculumPath {
		const pools = examDrills(path, drills);
		const checkpoints = path.checkpoints.flatMap((checkpoint) => {
			const at = checkpointAt(checkpoint, pools.get(checkpoint.id) ?? [], depthOfSkill, level);
			if (!at) return [];
			checkpointShown.add(checkpoint.id);
			return [at.checkpoint];
		});
		return {
			...path,
			after: path.after.filter((id) => pathShown.has(id)),
			skills: path.skills.filter((skill) => skillShown(skill.id)).map((skill) => ({ ...skill, after: skill.after.filter(skillShown) })),
			forks: path.forks
				.map((fork) => ({ ...fork, skillIds: fork.skillIds.filter(skillShown) }))
				.filter((fork) => fork.skillIds.length > 0),
			checkpoints
		};
	}

	const branches = curriculum.branches
		.map((branch) => ({ ...branch, paths: branch.paths.filter((path) => pathShown.has(path.id)).map(pathAt) }))
		.filter((branch) => branch.paths.length > 0);
	const shown = drills.filter(
		(drill) =>
			visibleAt(drill.depth, level) &&
			pathShown.has(drill.pathId) &&
			(drill.skillId === undefined || skillShown(drill.skillId)) &&
			(drill.checkpointId === undefined || checkpointShown.has(drill.checkpointId))
	);
	const questions = new Set(shown.map((drill) => drill.questionId));
	const followUps = curriculum.followUps.filter((followUp) => questions.has(followUp.questionId) && pathShown.has(followUp.pathId));
	return { branches, drills: shown, followUps };
}

function questionShown(id: string, level: Depth, depthOf: DepthMap): boolean {
	return visibleAt(Object.hasOwn(depthOf, id) ? depthOf[id]! : DEFAULT_DEPTH, level);
}

/** A deck with only the questions visible at `level`, in file order. It can come back empty. */
export function deckAt<D extends { questions: readonly { id: string }[] }>(deck: D, level: Depth, depthOf: DepthMap): D {
	return { ...deck, questions: deck.questions.filter((question) => questionShown(question.id, level, depthOf)) };
}

/** Each deck at `level` (see `deckAt`), leaving out decks with no visible question. */
export function decksAt<D extends { questions: readonly { id: string }[] }>(decks: readonly D[], level: Depth, depthOf: DepthMap): D[] {
	return decks.map((deck) => deckAt(deck, level, depthOf)).filter((deck) => deck.questions.length > 0);
}

/**
 * Whether a checkpoint is passed at any level where it is visible, so a pass
 * earned at one level counts at every level (#155, answer 1). Each level's pool
 * comes from the full curriculum's pairing, so it matches `curriculumAt`.
 * `full` must be the unfiltered curriculum. False for an unknown checkpoint, and
 * for one with no exam drill at any level (`examPassed` cannot pass an empty
 * pool; `projectCurriculum` decides what an unsittable checkpoint means).
 */
export function checkpointPassed(full: Curriculum, checkpointId: string, attempts: readonly Attempt[]): boolean {
	const path = full.branches.flatMap((branch) => branch.paths).find((item) => item.checkpoints.some((checkpoint) => checkpoint.id === checkpointId));
	const checkpoint = path?.checkpoints.find((item) => item.id === checkpointId);
	if (!path || !checkpoint) return false;
	const pool = examDrills(path, full.drills).get(checkpointId) ?? [];
	const depthOfSkill = skillDepths(full);
	return DEPTHS.some((level) => {
		if (!visibleAt(path.depth, level) || !path.skills.some((skill) => visibleAt(skill.depth, level))) return false;
		const at = checkpointAt(checkpoint, pool, depthOfSkill, level);
		return at !== null && examPassed(at.pool, at.checkpoint.mix, attempts);
	});
}
