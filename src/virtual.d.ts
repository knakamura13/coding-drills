/** Compiled from `content/decks/*.yaml` by `src/lib/content/vitePlugin.ts`. */

declare module 'virtual:decks' {
	import type { Deck } from '$lib/content/schema';
	/** Every deck in full. Only the routes that mix decks, and the server, load this. */
	export const decks: Deck[];
}

declare module 'virtual:deck-index' {
	import type { DeckSummary } from '$lib/content/schema';
	/** Every deck without its prompts and options: all that the menu, home, decks, and progress need. */
	export const decks: DeckSummary[];
}

declare module 'virtual:deck-loaders' {
	import type { Deck } from '$lib/content/schema';
	/** One lazy import per deck id. A lesson awaits its own deck only. */
	export const loaders: Record<string, () => Promise<{ deck: Deck }>>;
}

declare module 'virtual:deck/*' {
	import type { Deck } from '$lib/content/schema';
	export const deck: Deck;
}
