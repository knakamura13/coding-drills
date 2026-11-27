import { error, redirect } from '@sveltejs/kit';
import { curriculum } from 'virtual:curriculum';
import { REVIEW_SIZE } from '$lib/review/queue';
import { orderForReview } from '$lib/domain/exam';
import type { LessonEntry } from '$lib/domain/lesson';
import { curriculumAt } from '$lib/domain/depth';
import { drillsToReview } from '$lib/domain/mastery';
import { cardKey } from '$lib/domain/srs';
import { learnerDepth } from '$lib/preferences/store.svelte';
import { getRepository } from '$lib/storage';
import type { PageLoad } from './$types';

// Which drills come first depends on this device's attempts, so the sitting is chosen in the browser.
export const ssr = false;
export const prerender = false;

export const load: PageLoad = async ({ params, url }) => {
	const path = curriculum.branches.flatMap((branch) => branch.paths).find((item) => item.checkpoints.some((cp) => cp.id === params.checkpointId));
	const checkpoint = path?.checkpoints.find((item) => item.id === params.checkpointId);
	if (!path || !checkpoint) error(404, 'Checkpoint not found');

	// Review the path as the learner's depth level shows it (#155). A path that level hides goes back to the tree.
	const shown = curriculumAt(curriculum, learnerDepth());
	const shownPath = shown.branches.flatMap((branch) => branch.paths).find((item) => item.id === path.id);
	if (!shownPath?.checkpoints.some((item) => item.id === checkpoint.id)) redirect(307, '/tree');

	// The skills come from the failed sitting. Anything that is not a skill of this path at this level is ignored.
	const own = new Set(shownPath.skills.map((skill) => skill.id));
	const skills = (url.searchParams.get('skills') ?? '').split(',').filter((id) => own.has(id));
	const picked = orderForReview(drillsToReview(shownPath, shown.drills, skills), getRepository().attempts()).slice(0, REVIEW_SIZE);
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
		skillTitles: skills.map((id) => shownPath.skills.find((skill) => skill.id === id)!.title)
	};
};
