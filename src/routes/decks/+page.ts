import { decks } from 'virtual:deck-index';
import type { PageLoad } from './$types';

// The list is built at compile time. Progress for each row is filled in from the browser afterwards.
export const load: PageLoad = () => ({
	decks: decks.map(({ id, title, description, questions }) => ({
		id,
		title,
		description,
		count: questions.length
	}))
});
