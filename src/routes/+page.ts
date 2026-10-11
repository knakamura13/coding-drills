import { decks } from 'virtual:decks';
import type { PageLoad } from './$types';

export const load: PageLoad = () => ({
	decks: decks.map(({ id, title, description, questions }) => ({
		id,
		title,
		description,
		count: questions.length
	}))
});
