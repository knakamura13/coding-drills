import type { Curriculum } from '$lib/content/curriculum';
import type { Attempt } from '$lib/storage/types';
import { projectCurriculum, rollup } from './mastery';

/**
 * The piece of the mastery tree on the lesson summary (lesson Round 6): the nodes that led to this
 * lesson, ending at it. A lesson is a path on its branch; the nodes before it are the branch, then
 * the branch's earlier paths, of which the summary shows the last two.
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
	/** This lesson's name: its path's title, or the deck's title when no path maps it. */
	title: string;
}

export function lessonTrail(curriculum: Curriculum, attempts: readonly Attempt[], deckId: string, deckTitle: string): LessonTrail {
	const pathId = curriculum.drills.find((drill) => drill.deckId === deckId)?.pathId;
	const branch = pathId ? projectCurriculum(curriculum, attempts).branches.find((candidate) => candidate.paths.some((path) => path.id === pathId)) : undefined;
	if (!branch) return { earlier: [], title: deckTitle };
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
