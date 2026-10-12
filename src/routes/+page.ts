import { decks } from 'virtual:decks';
import { topics } from '$lib/review/practice';
import type { PageLoad } from './$types';

export const load: PageLoad = () => ({
	topics: topics(decks),
	totalQuestions: decks.reduce((sum, deck) => sum + deck.questions.length, 0),
	decks: decks.map(({ id, title, description, questions }) => ({
		id,
		title,
		description,
		count: questions.length
	}))
});
