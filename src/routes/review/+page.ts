import { redirect } from '@sveltejs/kit';
import { localDay } from '$lib/domain/days';
import { curriculum } from 'virtual:curriculum';
import { drillsOfSkill } from '$lib/domain/mastery';
import { cardKey } from '$lib/domain/srs';
import { reviewStatus } from '$lib/review/queue';
import { getRepository } from '$lib/storage';
import type { PageLoad } from './$types';

// Which questions are due depends on this device's attempts and today's date,
// so the sitting is chosen in the browser. A sitting can mix decks, so this
// route loads every deck in full.
export const ssr = false;
export const prerender = false;

export const load: PageLoad = async ({ url }) => {
	const { decks } = await import('virtual:decks');
	// `?skill=<id>` limits the sitting to what is due on one skill. An unknown skill is ignored.
	const skill = url.searchParams.get('skill');
	const drills = skill ? drillsOfSkill(curriculum, skill) : [];
	const only = drills.length > 0 ? new Set(drills.map((drill) => cardKey(drill.deckId, drill.questionId))) : undefined;
	const { entries } = reviewStatus(decks, getRepository().attempts(), localDay(new Date()), undefined, only, curriculum.drills);
	if (entries.length === 0) redirect(307, only ? '/tree' : '/');
	return { entries, limited: Boolean(only) };
};
