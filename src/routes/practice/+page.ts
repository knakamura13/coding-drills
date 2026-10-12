import { redirect } from '@sveltejs/kit';
import { decks } from 'virtual:decks';
import { practiceEntries } from '$lib/review/practice';
import type { PageLoad } from './$types';

// Questions are drawn at random each visit, so this renders in the browser.
export const ssr = false;
export const prerender = false;

export const load: PageLoad = ({ url }) => {
	const tag = url.searchParams.get('tag');
	const entries = practiceEntries(decks, tag);
	if (entries.length === 0) redirect(307, '/');
	return { entries, tag };
};
