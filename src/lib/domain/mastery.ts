import type { Curriculum, CurriculumDrill, CurriculumPath, Disposition } from '$lib/content/curriculum';
import type { Depth } from '$lib/content/depth';
import { compareAttempts } from '$lib/storage/guards';
import type { Attempt } from '$lib/storage/types';
import { checkpointPassed, curriculumAt } from './depth';
import { PASS_RULE } from './exam';
import { cardKey, countedAttempts, dueCards, replay } from './srs';

/**
 * PLACEHOLDER mastery, until curriculum design settles a threshold.
 * Change `skillState`, `pairInOrder`, and the two strings below together.
 *
 * Keep and rewrite drills are the teaching sequence. Exam drills are reserved
 * for checkpoints. Retired drills count toward neither. A drill whose mapping
 * names a `skill` belongs to it. Drills that name none are paired with the
 * path's skills in list order (main line, then each fork); extra drills pile
 * onto the last skill. That positional pairing is not a curriculum decision.
 *
 * A skill with no paired drill stays not started. A skill is mastered while
 * every paired drill's latest counted attempt was right: the first attempt on
 * that question on its most recent day. A miss on any paired drill drops the
 * skill back to practicing, and a later right answer restores it. Nothing is
 * stored: the log is replayed on each read, so every device agrees.
 *
 * The evidence is an attempt the log can count. Today that attempt is a
 * multiple-choice question. A richer lesson (#18) can feed `skillState` once
 * it writes an attempt, or replace the drill list here, without `examGate`
 * learning the lesson format.
 *
 * Decay is by recent miss only. Decay by time alone (a drill left unreviewed
 * far past its interval) is not decided. A skill that leaves the mastered set
 * locks an exam that has not been passed. A passed exam stays passed
 * (`examGate`). Quizzes (#20) are not a node and not a disposition. Keep and rewrite drills
 * are the only evidence that moves a skill.
 */
export const MASTERY_RULE =
	'Placeholder: a keep or rewrite drill counts toward the skill its mapping names, or toward a skill chosen by list order when it names none. A skill is mastered while the latest first-try-of-the-day answer on every paired drill was right, so a later miss drops it back to practicing. Exam and retired drills do not count, and a skill with no paired drill stays not started.';

/**
 * The lock is the gate rule: every skill in `requires` must be mastered,
 * including skills from other paths. Passed is derived from the attempt log by
 * `examPassed` (see `exam.ts`): a full sitting of exam drills on one day with
 * at most one first-try miss, and every kind the checkpoint requires answered
 * right. A passed checkpoint stays passed: the gate only locks an exam that
 * has not been passed.
 */
export const EXAM_RULE = `An exam stays locked until every skill it lists is mastered, including skills from other paths that lead into it. ${PASS_RULE}`;

export type SkillState = 'mastered' | 'practicing' | 'unexplored';
export type ExamState = 'locked' | 'available' | 'passed';

export interface ExamGate {
	state: ExamState;
	/** Unmastered skill ids, in the order the exam lists them. */
	remaining: string[];
}

/**
 * A passed exam stays passed, whatever happens to its skills afterwards (review
 * decay, #19), so work already done is never taken away. An exam not yet passed
 * is locked while any required skill is unmastered, and available once the last
 * of those skills is mastered. The mastered set is recomputed on each read.
 */
export function examGate(requires: readonly string[], mastered: ReadonlySet<string>, passed: boolean): ExamGate {
	if (passed) return { state: 'passed', remaining: [] };
	const remaining = requires.filter((id) => !mastered.has(id));
	if (remaining.length > 0) return { state: 'locked', remaining };
	return { state: 'available', remaining: [] };
}

/** Pairs `items` with `ids` in order. Further items join the last id. */
export function pairInOrder<T>(ids: readonly string[], items: readonly T[]): Map<string, T[]> {
	const paired = new Map<string, T[]>(ids.map((id) => [id, []]));
	if (ids.length === 0) return paired;
	const last = ids.length - 1;
	items.forEach((item, index) => {
		paired.get(ids[Math.min(index, last)]!)!.push(item);
	});
	return paired;
}

export function rollup(states: readonly SkillState[]): SkillState {
	if (states.length === 0 || states.every((state) => state === 'unexplored')) return 'unexplored';
	if (states.every((state) => state === 'mastered')) return 'mastered';
	return 'practicing';
}

export function skillLabel(state: SkillState): string {
	if (state === 'mastered') return 'Mastered';
	if (state === 'practicing') return 'Practicing';
	return 'Not started';
}

export function examLabel(gate: ExamGate): string {
	if (gate.state === 'passed') return 'Passed';
	if (gate.state === 'available') return 'Available';
	const count = gate.remaining.length;
	return `Locked · ${count} still needed`;
}

export function dispositionLabel(disposition: Disposition): string {
	if (disposition === 'keep') return 'Keep';
	if (disposition === 'rewrite') return 'Rewrite';
	if (disposition === 'exam') return 'Exam';
	return 'Retire';
}

interface DrillRef {
	deckId: string;
	questionId: string;
}

/** For each wanted drill that has a counted attempt: whether the latest one was right. */
function latestResults(drills: readonly DrillRef[], attempts: readonly Attempt[]): Map<string, boolean> {
	const wanted = new Set(drills.map((drill) => cardKey(drill.deckId, drill.questionId)));
	const latest = new Map<string, boolean>();
	for (const attempt of countedAttempts([...attempts].sort(compareAttempts))) {
		const key = cardKey(attempt.deckId, attempt.questionId);
		if (wanted.has(key)) latest.set(key, attempt.correct);
	}
	return latest;
}

/** Placeholder skill state. See `MASTERY_RULE`. */
export function skillState(drills: readonly DrillRef[], attempts: readonly Attempt[]): SkillState {
	if (drills.length === 0) return 'unexplored';
	const latest = latestResults(drills, attempts);
	const keys = drills.map((drill) => cardKey(drill.deckId, drill.questionId));
	if (keys.every((key) => latest.get(key) === true)) return 'mastered';
	if (keys.some((key) => latest.has(key))) return 'practicing';
	return 'unexplored';
}

/**
 * The exam drills each of a path's checkpoints draws from. A drill that names
 * its checkpoint goes there. The rest are paired by list position, so a path
 * with one checkpoint gives it every unnamed exam drill.
 */
export function examDrills(path: CurriculumPath, drills: readonly CurriculumDrill[]): Map<string, CurriculumDrill[]> {
	const exams = drills.filter((drill) => drill.pathId === path.id && drill.disposition === 'exam');
	const paired = pairInOrder(
		path.checkpoints.map((checkpoint) => checkpoint.id),
		exams.filter((drill) => !drill.checkpointId)
	);
	for (const drill of exams) {
		if (drill.checkpointId) paired.get(drill.checkpointId)?.push(drill);
	}
	return paired;
}

/**
 * The teaching drills a failed sitting sends the learner back to: those of the
 * named skills, or of every skill on the path when none is named.
 */
export function drillsToReview(path: CurriculumPath, drills: readonly CurriculumDrill[], skillIds: readonly string[]): CurriculumDrill[] {
	const bySkill = teachingBySkill(path, drills);
	const wanted = skillIds.length > 0 ? skillIds : path.skills.map((skill) => skill.id);
	return wanted.flatMap((id) => bySkill.get(id) ?? []);
}

/**
 * The skills a set of missed exam drills checks. Empty when any of them does not
 * say, so the review falls back to the whole path instead of guessing.
 */
export function skillsChecked(missed: readonly CurriculumDrill[]): string[] {
	if (missed.length === 0 || missed.some((drill) => !drill.tests || drill.tests.length === 0)) return [];
	return [...new Set(missed.flatMap((drill) => drill.tests ?? []))];
}

/** The keep and rewrite drills of one skill, wherever it sits in the curriculum. Empty for an unknown skill. */
export function drillsOfSkill(curriculum: Curriculum, skillId: string): CurriculumDrill[] {
	for (const branch of curriculum.branches) {
		for (const path of branch.paths) {
			if (path.skills.some((skill) => skill.id === skillId)) return teachingBySkill(path, curriculum.drills).get(skillId) ?? [];
		}
	}
	return [];
}

export interface DrillView {
	questionId: string;
	deckId: string;
	deckTitle: string;
	disposition: Disposition;
	dispositionLabel: string;
}

export interface SkillView {
	id: string;
	title: string;
	state: SkillState;
	status: string;
	/** The connector into this skill is lit. */
	lit: boolean;
	/** Paths whose checkpoints are not all passed yet, and which this skill's entrance waits on. */
	lockedBy: readonly { id: string; title: string }[];
	/** Drills of this skill that are due for review today. Zero when `today` is not given. */
	due: number;
	drills: readonly DrillView[];
	decks: readonly { deckId: string; deckTitle: string }[];
}

export interface PrerequisiteView {
	id: string;
	title: string;
	branchTitle: string;
	/** The prerequisite path sits in another branch. */
	cross: boolean;
	/** The last main skill of that path is mastered. */
	mastered: boolean;
	/** Every checkpoint of that path is passed, which is what opens the paths after it. */
	cleared: boolean;
}

export interface CheckpointView {
	id: string;
	title: string;
	summary: string;
	state: ExamState;
	status: string;
	lit: boolean;
	remaining: readonly { id: string; title: string; pathTitle: string; branchTitle: string }[];
	drills: readonly DrillView[];
}

export interface ForkView {
	id: string;
	title: string;
	skills: readonly SkillView[];
}

export interface PathView {
	id: string;
	title: string;
	summary: string;
	after: readonly PrerequisiteView[];
	afterNote?: string;
	main: readonly SkillView[];
	forks: readonly ForkView[];
	checkpoints: readonly CheckpointView[];
}

export interface BranchView {
	id: string;
	title: string;
	summary: string;
	state: SkillState;
	status: string;
	paths: readonly PathView[];
}

export interface TreeView {
	state: SkillState;
	status: string;
	branches: readonly BranchView[];
}

/**
 * A path's teaching drills grouped by skill. A drill that names its skill goes
 * there. The rest are paired by position, as `pairInOrder` does, counting only
 * the drills that name no skill.
 */
export function teachingBySkill(path: CurriculumPath, drills: readonly CurriculumDrill[]): Map<string, CurriculumDrill[]> {
	const teaching = drills.filter(
		(drill) => drill.pathId === path.id && (drill.disposition === 'keep' || drill.disposition === 'rewrite')
	);
	const paired = pairInOrder(
		path.skills.map((skill) => skill.id),
		teaching.filter((drill) => !drill.skillId)
	);
	for (const drill of teaching) {
		if (drill.skillId) paired.get(drill.skillId)?.push(drill);
	}
	return paired;
}

function toDrillView(drill: CurriculumDrill, deckTitles: ReadonlyMap<string, string>): DrillView {
	return {
		questionId: drill.questionId,
		deckId: drill.deckId,
		deckTitle: deckTitles.get(drill.deckId) ?? drill.deckId,
		disposition: drill.disposition,
		dispositionLabel: dispositionLabel(drill.disposition)
	};
}

/**
 * The tree as the screen shows it at a depth `level` (#155): skill states from
 * the placeholder rule over the drills visible at that level, and each
 * checkpoint's gate from `examGate`. `full` is the unfiltered curriculum: the
 * level's view comes from `curriculumAt`, and a checkpoint passed at any level
 * counts as passed (`checkpointPassed`).
 */
export function projectCurriculum(
	full: Curriculum,
	attempts: readonly Attempt[],
	level: Depth,
	deckTitles: ReadonlyMap<string, string> = new Map(),
	today?: string
): TreeView {
	const curriculum = curriculumAt(full, level);
	const dueKeys = new Set(
		today ? dueCards(replay([...attempts].sort(compareAttempts)).values(), today).map((card) => cardKey(card.deckId, card.questionId)) : []
	);
	const skillMeta = new Map<string, { title: string; pathTitle: string; branchTitle: string; pathId: string; after: readonly string[] }>();
	for (const branch of curriculum.branches) {
		for (const path of branch.paths) {
			for (const skill of path.skills) {
				skillMeta.set(skill.id, { title: skill.title, pathTitle: path.title, branchTitle: branch.title, pathId: path.id, after: skill.after });
			}
		}
	}

	const stateOf = new Map<string, SkillState>();
	for (const branch of curriculum.branches) {
		for (const path of branch.paths) {
			const paired = teachingBySkill(path, curriculum.drills);
			for (const skill of path.skills) {
				stateOf.set(skill.id, skillState(paired.get(skill.id) ?? [], attempts));
			}
		}
	}
	const mastered = new Set([...stateOf].filter(([, state]) => state === 'mastered').map(([id]) => id));

	const passedAt = new Map<string, boolean>();
	const passed = (checkpointId: string) => {
		if (!passedAt.has(checkpointId)) passedAt.set(checkpointId, checkpointPassed(full, checkpointId, attempts));
		return passedAt.get(checkpointId)!;
	};

	// A path is cleared when every checkpoint it shows is passed. A checkpoint with no exam drill at
	// this level cannot be sat, so it counts as passed rather than locking the paths after it forever.
	const pathTitles = new Map<string, string>();
	const cleared = new Map<string, boolean>();
	for (const branch of curriculum.branches) {
		for (const path of branch.paths) {
			pathTitles.set(path.id, path.title);
			const pools = examDrills(path, curriculum.drills);
			cleared.set(
				path.id,
				path.checkpoints.every((checkpoint) => (pools.get(checkpoint.id) ?? []).length === 0 || passed(checkpoint.id))
			);
		}
	}

	function lockedBy(skillId: string): { id: string; title: string }[] {
		const own = skillMeta.get(skillId);
		const waiting = new Set<string>();
		for (const before of own?.after ?? []) {
			const owner = skillMeta.get(before)?.pathId;
			if (owner && owner !== own?.pathId && !cleared.get(owner)) waiting.add(owner);
		}
		return [...waiting].map((id) => ({ id, title: pathTitles.get(id) ?? id }));
	}

	function skillView(skillId: string, drills: readonly CurriculumDrill[], lit: boolean): SkillView {
		const views = drills.map((drill) => toDrillView(drill, deckTitles));
		const decks: { deckId: string; deckTitle: string }[] = [];
		for (const view of views) {
			if (view.disposition !== 'keep' && view.disposition !== 'rewrite') continue;
			if (decks.some((deck) => deck.deckId === view.deckId)) continue;
			decks.push({ deckId: view.deckId, deckTitle: view.deckTitle });
		}
		const state = stateOf.get(skillId) ?? 'unexplored';
		return {
			id: skillId,
			title: skillMeta.get(skillId)?.title ?? skillId,
			state,
			status: skillLabel(state),
			lit,
			lockedBy: lockedBy(skillId),
			due: drills.filter((drill) => dueKeys.has(cardKey(drill.deckId, drill.questionId))).length,
			drills: views,
			decks
		};
	}

	const branches: BranchView[] = curriculum.branches.map((branch) => {
		const paths: PathView[] = branch.paths.map((path) => {
			const paired = teachingBySkill(path, curriculum.drills);
			const examPaired = examDrills(path, curriculum.drills);
			const viewFor = (skill: (typeof path.skills)[number]): SkillView => {
				const parentsMastered = skill.after.length > 0 && skill.after.every((id) => mastered.has(id));
				const started = (stateOf.get(skill.id) ?? 'unexplored') !== 'unexplored';
				return skillView(skill.id, paired.get(skill.id) ?? [], skill.after.length === 0 ? started : parentsMastered);
			};
			const checkpoints: CheckpointView[] = path.checkpoints.map((checkpoint) => {
				const drillViews = (examPaired.get(checkpoint.id) ?? []).map((drill) => toDrillView(drill, deckTitles));
				const gate = examGate(checkpoint.requires, mastered, passed(checkpoint.id));
				return {
					id: checkpoint.id,
					title: checkpoint.title,
					summary: checkpoint.summary,
					state: gate.state,
					status: examLabel(gate),
					lit: gate.state !== 'locked',
					remaining: gate.remaining.map((id) => {
						const meta = skillMeta.get(id);
						return {
							id,
							title: meta?.title ?? id,
							pathTitle: meta?.pathTitle ?? '',
							branchTitle: meta?.branchTitle ?? ''
						};
					}),
					drills: drillViews
				};
			});
			return {
				id: path.id,
				title: path.title,
				summary: path.summary,
				after: path.after.map((id) => {
					const prerequisite = curriculum.branches.flatMap((item) => item.paths).find((item) => item.id === id);
					const lastMain = [...(prerequisite?.skills ?? [])].reverse().find((skill) => skill.line === 'main');
					const branchTitle =
						curriculum.branches.find((item) => item.id === prerequisite?.branchId)?.title ?? '';
					return {
						id,
						title: prerequisite?.title ?? id,
						branchTitle,
						cross: prerequisite?.branchId !== path.branchId,
						mastered: lastMain ? mastered.has(lastMain.id) : false,
						cleared: cleared.get(id) ?? false
					};
				}),
				...(path.afterNote ? { afterNote: path.afterNote } : {}),
				main: path.skills.filter((skill) => skill.line === 'main').map(viewFor),
				forks: path.forks.map((fork) => ({
					id: fork.id,
					title: fork.title,
					skills: path.skills.filter((skill) => skill.line === fork.id).map(viewFor)
				})),
				checkpoints
			};
		});
		const states = paths.flatMap((path) => [
			...path.main.map((skill) => skill.state),
			...path.forks.flatMap((fork) => fork.skills.map((skill) => skill.state))
		]);
		const state = rollup(states);
		return { id: branch.id, title: branch.title, summary: branch.summary, state, status: skillLabel(state), paths };
	});

	const state = rollup(branches.map((branch) => branch.state));
	return { state, status: skillLabel(state), branches };
}
