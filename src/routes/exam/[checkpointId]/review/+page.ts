import { error, redirect } from '@sveltejs/kit';
import { curriculum } from 'virtual:curriculum';
import { REVIEW_SIZE } from '$lib/review/queue';
import { orderForReview } from '$lib/domain/exam';
import type { LessonEntry } from '$lib/domain/lesson';
import { drillsToReview } from '$lib/domain/mastery';
import { cardKey } from '$lib/domain/srs';
import { getRepository } from '$lib/storage';
import type { PageLoad } from './$types';

// Which drills come first depends on this device's attempts, so the sitting is chosen in the browser.
export const ssr = false;
export const prerender = false;

export const load: PageLoad = async ({ params, url }) => {
	const path = curriculum.branches.flatMap((branch) => branch.paths).find((item) => item.checkpoints.some((cp) => cp.id === params.checkpointId));
	const checkpoint = path?.checkpoints.find((item) => item.id === params.checkpointId);
	if (!path || !checkpoint) error(404, 'Checkpoint not found');

	// The skills come from the failed sitting. Anything that is not a skill of this path is ignored.
	const own = new Set(path.skills.map((skill) => skill.id));
	const skills = (url.searchParams.get('skills') ?? '').split(',').filter((id) => own.has(id));
	const picked = orderForReview(drillsToReview(path, curriculum.drills, skills), getRepository().attempts()).slice(0, REVIEW_SIZE);
	if (picked.length === 0) redirect(307, '/tree');

	const { decks } = await import('virtual:decks');
	const questions = new Map(
		decks.flatMap((deck) =>
			deck.questions.map((question): [string, LessonEntry] => [cardKey(deck.id, question.id), { deckId: deck.id, heading: deck.heading, question }])
		)
	);
	return {
		title: checkpoint.title,
		checkpointId: checkpoint.id,
		entries: picked.map((drill) => questions.get(cardKey(drill.deckId, drill.questionId))!),
		skillTitles: skills.map((id) => path.skills.find((skill) => skill.id === id)!.title)
	};
};
