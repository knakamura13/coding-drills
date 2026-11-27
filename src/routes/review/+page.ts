import { redirect } from '@sveltejs/kit';
import { localDay } from '$lib/domain/days';
import { curriculum } from 'virtual:curriculum';
import { curriculumAt } from '$lib/domain/depth';
import { teachingBySkill } from '$lib/domain/mastery';
import { cardKey } from '$lib/domain/srs';
import { learnerDepth } from '$lib/preferences/store.svelte';
import { decksAtLearnerLevel } from '$lib/review/level';
import { reviewStatus } from '$lib/review/queue';
import { getRepository } from '$lib/storage';
import type { PageLoad } from './$types';

// Which questions are due depends on this device's attempts and today's date,
// so the sitting is chosen in the browser. A sitting can mix decks, so this
// route loads every deck in full.
export const ssr = false;
export const prerender = false;

export const load: PageLoad = async ({ url }) => {
	const { decks: allDecks } = await import('virtual:decks');
	// Only what the learner's level shows (#155): a deeper question is never due here, and a
	// deeper drill is never offered as a fresh variant.
	const level = learnerDepth();
	const decks = decksAtLearnerLevel(allDecks, level);
	const shown = curriculumAt(curriculum, level);
	// `?skill=<id>` limits the sitting to what is due on one skill. An unknown skill, or one deeper
	// than the level, is ignored.
	const skill = url.searchParams.get('skill');
	const bySkill = new Map(
		shown.branches.flatMap((branch) => branch.paths.flatMap((path) => [...teachingBySkill(path, shown.drills)]))
	);
	const drills = (skill && bySkill.get(skill)) || [];
	const only = drills.length > 0 ? new Set(drills.map((drill) => cardKey(drill.deckId, drill.questionId))) : undefined;
	const { entries } = reviewStatus(decks, getRepository().attempts(), localDay(new Date()), undefined, only, bySkill);
	if (entries.length === 0) redirect(307, only ? '/tree' : '/');
	return { entries, limited: Boolean(only) };
};
