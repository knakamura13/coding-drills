import { redirect } from '@sveltejs/kit';
import { decks } from 'virtual:decks';
import { localDay } from '$lib/domain/days';
import { reviewStatus } from '$lib/review/queue';
import { getRepository } from '$lib/storage';
import type { PageLoad } from './$types';

// Which questions are due depends on this device's attempts and today's date,
// so the sitting is chosen in the browser.
export const ssr = false;
export const prerender = false;

export const load: PageLoad = () => {
	const { entries } = reviewStatus(decks, getRepository().attempts(), localDay(new Date()));
	if (entries.length === 0) redirect(307, '/');
	return {
		entries: entries.map(({ deckId, question }) => ({
			deckId,
			question,
			heading: decks.find((deck) => deck.id === deckId)?.heading
		}))
	};
};
