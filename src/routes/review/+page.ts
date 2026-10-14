import { redirect } from '@sveltejs/kit';
import { localDay } from '$lib/domain/days';
import { reviewStatus } from '$lib/review/queue';
import { getRepository } from '$lib/storage';
import type { PageLoad } from './$types';

// Which questions are due depends on this device's attempts and today's date,
// so the sitting is chosen in the browser. A sitting can mix decks, so this
// route loads every deck in full.
export const ssr = false;
export const prerender = false;

export const load: PageLoad = async () => {
	const { decks } = await import('virtual:decks');
	const { entries } = reviewStatus(decks, getRepository().attempts(), localDay(new Date()));
	if (entries.length === 0) redirect(307, '/');
	return { entries };
};
