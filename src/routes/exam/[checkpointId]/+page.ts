import { error, redirect } from '@sveltejs/kit';
import { curriculum } from 'virtual:curriculum';
import type { LessonEntry } from '$lib/domain/lesson';
import { EXAM_SIZE, drawExam } from '$lib/domain/exam';
import { examDrills, projectCurriculum } from '$lib/domain/mastery';
import { cardKey } from '$lib/domain/srs';
import { getRepository } from '$lib/storage';
import type { PageLoad } from './$types';

// Whether the exam is open depends on this device's attempts, and the items are
// drawn at random, so the sitting is chosen in the browser.
export const ssr = false;
export const prerender = false;

export const load: PageLoad = async ({ params }) => {
	const path = curriculum.branches.flatMap((branch) => branch.paths).find((item) => item.checkpoints.some((cp) => cp.id === params.checkpointId));
	const checkpoint = path?.checkpoints.find((item) => item.id === params.checkpointId);
	if (!path || !checkpoint) error(404, 'Checkpoint not found');

	const view = projectCurriculum(curriculum, getRepository().attempts())
		.branches.flatMap((branch) => branch.paths)
		.flatMap((item) => item.checkpoints)
		.find((item) => item.id === checkpoint.id);
	const pool = examDrills(path, curriculum.drills).get(checkpoint.id) ?? [];
	if (view?.state === 'locked' || pool.length === 0) redirect(307, '/tree');

	const { decks } = await import('virtual:decks');
	const questions = new Map(
		decks.flatMap((deck) =>
			deck.questions.map((question): [string, LessonEntry] => [
				cardKey(deck.id, question.id),
				{ deckId: deck.id, heading: deck.heading, question }
			])
		)
	);
	// The sitting is fixed when the page loads, so retrying replays the same items.
	const entries = drawExam(pool, checkpoint.mix, EXAM_SIZE, Math.random).map((drill) => questions.get(cardKey(drill.deckId, drill.questionId))!);
	return {
		title: checkpoint.title,
		checkpointId: checkpoint.id,
		entries,
		pool,
		mix: checkpoint.mix,
		/** Skill titles by id, to name what a failed sitting should review. */
		skillTitles: Object.fromEntries(path.skills.map((skill) => [skill.id, skill.title]))
	};
};
