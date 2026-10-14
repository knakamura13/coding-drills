import { decks } from 'virtual:deck-index';
import { topics } from '$lib/review/practice';
import type { PageLoad } from './$types';

// Only what the build knows goes here. Progress lives in the browser, so the cards that depend on it
// are filled in after the page loads, in slots that already have their height (see the page styles).
export const load: PageLoad = () => ({
	topics: topics(decks),
	totalQuestions: decks.reduce((sum, deck) => sum + deck.questions.length, 0),
	deckCount: decks.length
});
