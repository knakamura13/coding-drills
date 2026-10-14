import { redirect } from '@sveltejs/kit';
import { practiceEntries } from '$lib/review/practice';
import type { PageLoad } from './$types';

// Questions are drawn at random each visit, so this renders in the browser.
// Mixed practice draws from every deck, so this route loads them all in full.
export const ssr = false;
export const prerender = false;

export const load: PageLoad = async ({ url }) => {
	const { decks } = await import('virtual:decks');
	const tag = url.searchParams.get('tag');
	const entries = practiceEntries(decks, tag);
	if (entries.length === 0) redirect(307, '/');
	return { entries, tag };
};
