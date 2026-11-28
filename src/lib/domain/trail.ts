import type { Curriculum } from '$lib/content/curriculum';
import type { Depth } from '$lib/content/depth';
import type { Attempt } from '$lib/storage/types';
import { curriculumAt } from './depth';
import { projectCurriculum, rollup } from './mastery';

/**
 * The piece of the mastery tree on the lesson summary (lesson Round 6): the nodes that led to this
 * lesson, ending at it. A lesson is a path on its branch; the nodes before it are the branch, then
 * the branch's earlier paths, of which the summary shows the last two. A deck that holds drills
 * from several paths is no one path, so it shows only its branch, when they share
 * one, before a leaf with the deck's own title. Only paths and drills visible at the learner's
 * depth `level` count (#155); `full` is the unfiltered curriculum.
 */

export interface TrailNode {
	kind: 'branch' | 'lesson';
	id: string;
	title: string;
	/** A lesson whose skills are all mastered. Always false for the branch node. */
	mastered: boolean;
}

export interface LessonTrail {
	/** Up to two nodes before this lesson, oldest first. Empty for a deck no path maps. */
	earlier: TrailNode[];
	/** This lesson's name: its path's title, or the deck's title when no one path maps it. */
	title: string;
}

export function lessonTrail(full: Curriculum, attempts: readonly Attempt[], deckId: string, deckTitle: string, level: Depth): LessonTrail {
	const pathIds = new Set(curriculumAt(full, level).drills.filter((drill) => drill.deckId === deckId).map((drill) => drill.pathId));
	const branches = projectCurriculum(full, attempts, level).branches.filter((candidate) => candidate.paths.some((path) => pathIds.has(path.id)));
	if (branches.length !== 1) return { earlier: [], title: deckTitle };
	const branch = branches[0]!;
	if (pathIds.size > 1) return { earlier: [{ kind: 'branch', id: branch.id, title: branch.title, mastered: false }], title: deckTitle };
	const pathId = [...pathIds][0];
	const at = branch.paths.findIndex((path) => path.id === pathId);
	const chain: TrailNode[] = [
		{ kind: 'branch', id: branch.id, title: branch.title, mastered: false },
		...branch.paths.slice(0, at).map((path) => {
			const skills = [...path.main, ...path.forks.flatMap((fork) => fork.skills)];
			return { kind: 'lesson' as const, id: path.id, title: path.title, mastered: rollup(skills.map((skill) => skill.state)) === 'mastered' };
		})
	];
	return { earlier: chain.slice(-2), title: branch.paths[at]!.title };
}
