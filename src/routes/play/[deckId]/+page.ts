import { error } from '@sveltejs/kit';
import { loaders } from 'virtual:deck-loaders';
import { curriculum } from 'virtual:curriculum';
import { depths } from 'virtual:depths';
import { branchOfDeck } from '$lib/content/curriculum';
import { deckAt } from '$lib/domain/depth';
import { learnerDepth } from '$lib/preferences/store.svelte';
import type { BranchId } from '$lib/ui/branch';
import type { PageLoad } from './$types';

// Option order is random and lesson state lives in the browser, so this route renders on the
// client only. It loads its own deck and no other, with the questions the learner's depth level shows (#155).
export const ssr = false;
export const prerender = false;

export const load: PageLoad = async ({ params }) => {
	if (!Object.hasOwn(loaders, params.deckId)) error(404, 'Deck not found');
	const { deck } = await loaders[params.deckId]();
	const level = learnerDepth();
	// The accent comes from the full curriculum: list order there decides a deck's branch.
	return { deck: deckAt(deck, level, depths), level, branch: branchOfDeck(curriculum, deck.id) as BranchId | null };
};
