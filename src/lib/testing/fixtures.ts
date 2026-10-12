import type { Deck } from '$lib/content/schema';
import type { Attempt } from '$lib/storage/types';

/** A small deck with tagged questions, for tests that need decks but not real content. */
export function deck(id: string, questions: { id: string; tags?: string[] }[], heading?: string): Deck {
	return {
		id,
		title: id,
		description: 'd',
		heading,
		questions: questions.map(({ id: questionId, tags }) => ({
			id: questionId,
			tags,
			prompt: 'p',
			options: [
				{ id: 'right', text: 'Right', explanation: 'e' },
				{ id: 'wrong', text: 'Wrong', explanation: 'e' }
			],
			correct: 'right',
			followUps: {
				wrong: {
					prompt: 'f',
					options: [
						{ id: 'x', text: 'X' },
						{ id: 'y', text: 'Y' }
					],
					correct: 'x',
					explanation: 'e'
				}
			}
		}))
	};
}

let counter = 0;

/** An attempt with a unique, ordered id. `result` follows the grading: good, hard (wrong then right), again. */
export function attempt(
	deckId: string,
	questionId: string,
	day: string,
	result: 'good' | 'hard' | 'again' = 'good'
): Attempt {
	counter += 1;
	return {
		id: `fx${String(counter).padStart(8, '0')}`,
		at: `${day}T12:00:00.${String(counter % 1000).padStart(3, '0')}Z`,
		day,
		deckId,
		questionId,
		pickedId: result === 'good' ? 'right' : 'wrong',
		correct: result === 'good',
		...(result === 'good' ? {} : { followUp: { pickedId: result === 'hard' ? 'x' : 'y', correct: result === 'hard' } })
	};
}
