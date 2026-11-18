import type { Curriculum, CurriculumDrill, Disposition } from '$lib/content/curriculum';
import { compareAttempts } from '$lib/storage/guards';
import type { Attempt } from '$lib/storage/types';
import { cardKey, countedAttempts } from './srs';

/**
 * PLACEHOLDER mastery, until curriculum design settles a threshold.
 * Change `skillState`, `pairInOrder`, and the two strings below together.
 *
 * Keep and rewrite drills are the teaching sequence. Exam drills are reserved
 * for checkpoints. Retired drills count toward neither. Drills are paired with
 * a path's skills in list order (main line, then each fork); extra drills pile
 * onto the last skill. That pairing is not a curriculum decision.
 *
 * A skill with no paired drill stays not started. A skill is mastered when
 * every paired drill has a counted correct attempt: the first attempt on that
 * question for some day was right. Any other attempt on a paired drill means
 * the skill is being practiced.
 */
export const MASTERY_RULE =
	'Placeholder: keep and rewrite drills are paired with skills in list order. A skill is mastered when every paired drill was answered right on the first try of some day. Exam and retired drills do not count, and a skill with no paired drill stays not started.';

/**
 * PLACEHOLDER exam result. The lock itself is the real gate rule: every skill
 * in `requires` must be mastered, including skills from other paths. Passed is
 * not a decided pass mark. It only means the gate is open and a counted correct
 * attempt exists on an exam drill paired with that checkpoint.
 */
export const EXAM_RULE =
	'An exam stays locked until every skill it lists is mastered, including skills from other paths that lead into it, and it unlocks as soon as the last one is mastered. Passed is a placeholder: the gate is open and an exam drill paired with that checkpoint was answered right on a first try.';

export type SkillState = 'mastered' | 'practicing' | 'unexplored';
export type ExamState = 'locked' | 'available' | 'passed';

export interface ExamGate {
	state: ExamState;
	/** Unmastered skill ids, in the order the exam lists them. */
	remaining: string[];
}

/**
 * An exam is locked while any required skill is unmastered. It is available
 * once the last of those skills is mastered, and passed only when `passed` is
 * also true. A passed flag does not open a locked exam.
 */
export function examGate(requires: readonly string[], mastered: ReadonlySet<string>, passed: boolean): ExamGate {
	const remaining = requires.filter((id) => !mastered.has(id));
	if (remaining.length > 0) return { state: 'locked', remaining };
	if (passed) return { state: 'passed', remaining: [] };
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

/** Placeholder exam result. See `EXAM_RULE`. True when any paired exam drill has a counted correct attempt. */
export function examDrillPassed(drills: readonly DrillRef[], attempts: readonly Attempt[]): boolean {
	if (drills.length === 0) return false;
	const { correct } = attemptKeys(drills, attempts);
	return drills.some((drill) => correct.has(cardKey(drill.deckId, drill.questionId)));
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

function teaching(drills: readonly CurriculumDrill[], pathId: string): CurriculumDrill[] {
	return drills.filter(
		(drill) => drill.pathId === pathId && (drill.disposition === 'keep' || drill.disposition === 'rewrite')
	);
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
			const paired = pairInOrder(path.skills.map((skill) => skill.id), teaching(curriculum.drills, path.id));
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
			const paired = pairInOrder(path.skills.map((skill) => skill.id), teaching(curriculum.drills, path.id));
			const exams = curriculum.drills.filter((drill) => drill.pathId === path.id && drill.disposition === 'exam');
			const examPaired = pairInOrder(
				path.checkpoints.map((checkpoint) => checkpoint.id),
				exams
			);
			const viewFor = (skill: (typeof path.skills)[number]): SkillView => {
				const parentsMastered = skill.after.length > 0 && skill.after.every((id) => mastered.has(id));
				const started = (stateOf.get(skill.id) ?? 'unexplored') !== 'unexplored';
				return skillView(skill.id, paired.get(skill.id) ?? [], skill.after.length === 0 ? started : parentsMastered);
			};
			const checkpoints: CheckpointView[] = path.checkpoints.map((checkpoint) => {
				const drillViews = (examPaired.get(checkpoint.id) ?? []).map((drill) => toDrillView(drill, deckTitles));
				const passed = examDrillPassed(examPaired.get(checkpoint.id) ?? [], attempts);
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
