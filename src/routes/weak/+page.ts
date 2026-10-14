import { redirect } from '@sveltejs/kit';
import { weakStatus } from '$lib/review/weak';
import { getRepository } from '$lib/storage';
import type { PageLoad } from './$types';

// The sitting depends on this device's attempts, so it is chosen in the browser.
// Weak spots can come from any deck, so this route loads every deck in full.
export const ssr = false;
export const prerender = false;

export const load: PageLoad = async () => {
	const { decks } = await import('virtual:decks');
	const { entries } = weakStatus(decks, getRepository().attempts());
	if (entries.length === 0) redirect(307, '/');
	return { entries };
};
