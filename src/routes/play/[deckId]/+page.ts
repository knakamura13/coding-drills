import { error } from '@sveltejs/kit';
import { loaders } from 'virtual:deck-loaders';
import type { PageLoad } from './$types';

// Option order is random and all lesson state lives in the browser, so this
// route renders on the client only. It loads its own deck and no other.
export const ssr = false;
export const prerender = false;

export const load: PageLoad = async ({ params }) => {
	if (!Object.hasOwn(loaders, params.deckId)) error(404, 'Deck not found');
	const { deck } = await loaders[params.deckId]();
	return { deck };
};
