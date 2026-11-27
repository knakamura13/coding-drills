import { redirect } from '@sveltejs/kit';
import { decksAtLearnerLevel } from '$lib/review/level';
import { weakStatus } from '$lib/review/weak';
import { getRepository } from '$lib/storage';
import type { PageLoad } from './$types';

// The sitting depends on this device's attempts, so it is chosen in the browser.
// Weak spots can come from any deck, so this route loads every deck in full.
export const ssr = false;
export const prerender = false;

export const load: PageLoad = async () => {
	const { decks } = await import('virtual:decks');
	// Only questions at the learner's level (#155).
	const { entries } = weakStatus(decksAtLearnerLevel(decks), getRepository().attempts());
	if (entries.length === 0) redirect(307, '/');
	return { entries };
};
