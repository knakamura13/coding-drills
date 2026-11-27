import { depths } from 'virtual:depths';
import type { Depth } from '$lib/content/depth';
import { decksAt } from '$lib/domain/depth';
import { learnerDepth } from '$lib/preferences/store.svelte';

type DeckLike = { questions: readonly { id: string }[] };

const cache = new WeakMap<readonly DeckLike[], Map<Depth, DeckLike[]>>();

/**
 * The decks at the learner's depth level (#155), with only their visible questions and without
 * decks left empty. The level is read on every call, so a change shows on the next read. The
 * decks are static build data, so each list and level is filtered once and the same array comes
 * back after that: a page that derives from it does not re-render while the level stays put.
 * Treat the result as read-only.
 */
export function decksAtLearnerLevel<D extends DeckLike>(decks: readonly D[], level: Depth = learnerDepth()): D[] {
	let byLevel = cache.get(decks);
	if (!byLevel) {
		byLevel = new Map();
		cache.set(decks, byLevel);
	}
	let shown = byLevel.get(level);
	if (!shown) {
		shown = decksAt(decks, level, depths);
		byLevel.set(level, shown);
	}
	return shown as D[];
}
