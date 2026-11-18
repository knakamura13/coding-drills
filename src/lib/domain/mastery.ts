import type { Curriculum, CurriculumDrill, CurriculumPath, Disposition } from '$lib/content/curriculum';
import { compareAttempts } from '$lib/storage/guards';
import type { Attempt } from '$lib/storage/types';
import { PASS_RULE, examPassed } from './exam';
import { cardKey, countedAttempts } from './srs';

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
 * A skill with no paired drill stays not started. A skill is mastered when
 * every paired drill has a counted correct attempt: the first attempt on that
 * question for some day was right. Any other attempt on a paired drill means
 * the skill is being practiced.
 *
 * The evidence is an attempt the log can count. Today that attempt is a
 * multiple-choice question. A richer lesson (#18) can feed `skillState` once
 * it writes an attempt, or replace the drill list here, without `examGate`
 * learning the lesson format.
 *
 * Recency is ignored, so one old correct attempt masters the skill for good.
 * Review decay (#19) belongs in `skillState`: drop the skill out of the
 * mastered set and every exam that requires it locks again, including one
 * that had passed. Whether a passed exam should stay passed is not decided.
 * Quizzes (#20) are not a node and not a disposition. Keep and rewrite drills
 * are the only evidence that moves a skill.
 */
export const MASTERY_RULE =
	'Placeholder: a keep or rewrite drill counts toward the skill its mapping names, or toward a skill chosen by list order when it names none. A skill is mastered when every paired drill was answered right on the first try of some day. Exam and retired drills do not count, and a skill with no paired drill stays not started.';

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

function attemptKeys(drills: readonly DrillRef[], attempts: readonly Attempt[]): { correct: Set<string>; seen: Set<string> } {
	const wanted = new Set(drills.map((drill) => cardKey(drill.deckId, drill.questionId)));
	const correct = new Set<string>();
	const seen = new Set<string>();
	const ordered = [...attempts].sort(compareAttempts);
	for (const attempt of countedAttempts(ordered)) {
		const key = cardKey(attempt.deckId, attempt.questionId);
		if (!wanted.has(key)) continue;
		seen.add(key);
		if (attempt.correct) correct.add(key);
	}
	return { correct, seen };
}

/** Placeholder skill state. See `MASTERY_RULE`. */
export function skillState(drills: readonly DrillRef[], attempts: readonly Attempt[]): SkillState {
	if (drills.length === 0) return 'unexplored';
	const { correct, seen } = attemptKeys(drills, attempts);
	const keys = drills.map((drill) => cardKey(drill.deckId, drill.questionId));
	if (keys.every((key) => correct.has(key))) return 'mastered';
	if (keys.some((key) => seen.has(key))) return 'practicing';
	return 'unexplored';
}

/**
 * The exam drills each of a path's checkpoints draws from. A path with one
 * checkpoint gives it every exam drill. With two, drills are paired by list
 * position, as skills are, until exam drills name their checkpoint.
 */
export function examDrills(path: CurriculumPath, drills: readonly CurriculumDrill[]): Map<string, CurriculumDrill[]> {
	const exams = drills.filter((drill) => drill.pathId === path.id && drill.disposition === 'exam');
	return pairInOrder(
		path.checkpoints.map((checkpoint) => checkpoint.id),
		exams
	);
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
function teachingBySkill(path: CurriculumPath, drills: readonly CurriculumDrill[]): Map<string, CurriculumDrill[]> {
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
 * The tree as the screen shows it: skill states from the placeholder rule,
 * and each checkpoint's gate from `examGate`.
 */
export function projectCurriculum(
	curriculum: Curriculum,
	attempts: readonly Attempt[],
	deckTitles: ReadonlyMap<string, string> = new Map()
): TreeView {
	const skillMeta = new Map<string, { title: string; pathTitle: string; branchTitle: string; pathId: string }>();
	for (const branch of curriculum.branches) {
		for (const path of branch.paths) {
			for (const skill of path.skills) {
				skillMeta.set(skill.id, { title: skill.title, pathTitle: path.title, branchTitle: branch.title, pathId: path.id });
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
				const passed = examPassed(examPaired.get(checkpoint.id) ?? [], checkpoint.mix, attempts);
				const gate = examGate(checkpoint.requires, mastered, passed);
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
						mastered: lastMain ? mastered.has(lastMain.id) : false
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
