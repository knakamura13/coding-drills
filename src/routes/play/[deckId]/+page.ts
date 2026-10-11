import { error } from '@sveltejs/kit';
import { decks } from 'virtual:decks';
import type { PageLoad } from './$types';

// Option order is random and all lesson state lives in the browser, so this
// route renders on the client only.
export const ssr = false;
export const prerender = false;

export const load: PageLoad = ({ params }) => {
	const deck = decks.find((candidate) => candidate.id === params.deckId);
	if (!deck) error(404, 'Deck not found');
	return { deck };
};
