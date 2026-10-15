import { describe, expect, it } from 'vitest';
import { deckSchema, formatIssues, repeatsFollowUpAnswer, type Deck } from './schema.ts';

function validDeck(): Deck {
	return {
		id: 'sample-deck',
		title: 'Sample deck',
		description: 'One question, used to exercise the schema.',
		questions: [
			{
				id: 'sample-question',
				prompt: 'Pick the right one.',
				options: [
					{ id: 'right', text: 'Right', explanation: 'Because it is right.' },
					{ id: 'wrong-a', text: 'Wrong A', explanation: 'Because it is wrong.' },
					{ id: 'wrong-b', text: 'Wrong B', explanation: 'Also wrong.' }
				],
				correct: 'right',
				followUps: {
					'wrong-a': {
						prompt: 'Why is A wrong?',
						options: [
							{ id: 'x', text: 'Reason X' },
							{ id: 'y', text: 'Reason Y' }
						],
						correct: 'x',
						explanation: 'Reason X is the one.'
					},
					'wrong-b': {
						prompt: 'Why is B wrong?',
						options: [
							{ id: 'x', text: 'Reason X' },
							{ id: 'y', text: 'Reason Y' }
						],
						correct: 'y',
						explanation: 'Reason Y is the one.'
					}
				}
			}
		]
	};
}

function issuesFor(deck: unknown): string {
	const result = deckSchema.safeParse(deck);
	return result.success ? '' : formatIssues('deck.yaml', result.error.issues);
}

describe('deckSchema', () => {
	it('accepts a deck where every wrong option has a follow-up', () => {
		expect(deckSchema.safeParse(validDeck()).success).toBe(true);
	});

	it('rejects a wrong option without a follow-up and names it', () => {
		const deck = validDeck();
		delete deck.questions[0].followUps['wrong-b'];
		expect(issuesFor(deck)).toContain('wrong option "wrong-b" has no follow-up');
	});

	it('rejects a follow-up attached to the correct option', () => {
		const deck = validDeck();
		deck.questions[0].followUps['right'] = deck.questions[0].followUps['wrong-a'];
		expect(issuesFor(deck)).toContain('the correct option "right" must not have a follow-up');
	});

	it('rejects a follow-up keyed by an id that is not an option', () => {
		const deck = validDeck();
		deck.questions[0].followUps['ghost'] = deck.questions[0].followUps['wrong-a'];
		expect(issuesFor(deck)).toContain('follow-up key "ghost" is not an option id');
	});

	it('rejects a correct id that is not an option', () => {
		const deck = validDeck();
		deck.questions[0].correct = 'missing';
		expect(issuesFor(deck)).toContain('"missing" is not one of the option ids');
	});

	it('rejects duplicate option ids and duplicate option text', () => {
		const deck = validDeck();
		deck.questions[0].options[2] = { ...deck.questions[0].options[1] };
		const issues = issuesFor(deck);
		expect(issues).toContain('duplicate option id "wrong-a"');
		expect(issues).toContain('duplicate option text');
	});

	it('rejects a follow-up whose correct id is not one of its options', () => {
		const deck = validDeck();
		deck.questions[0].followUps['wrong-a'].correct = 'z';
		expect(issuesFor(deck)).toContain('"z" is not one of the option ids');
	});

	it('rejects duplicate ids inside a follow-up', () => {
		const deck = validDeck();
		deck.questions[0].followUps['wrong-a'].options[1] = { id: 'x', text: 'Reason X' };
		const issues = issuesFor(deck);
		expect(issues).toContain('duplicate option id "x"');
		expect(issues).toContain('duplicate option text');
	});

	it('rejects duplicate question ids', () => {
		const deck = validDeck();
		deck.questions.push(structuredClone(deck.questions[0]));
		expect(issuesFor(deck)).toContain('duplicate question id "sample-question"');
	});

	it('rejects questions with fewer than two options', () => {
		const deck = validDeck();
		deck.questions[0].options = deck.questions[0].options.slice(0, 1);
		deck.questions[0].followUps = {};
		expect(issuesFor(deck)).toContain('questions.0.options');
	});

	it('rejects ids that are not lowercase kebab-case', () => {
		const deck = validDeck();
		deck.id = 'Sample Deck';
		expect(issuesFor(deck)).toContain('use lowercase kebab-case');
	});

	it('rejects unknown keys so typos do not pass silently', () => {
		const deck = { ...validDeck(), subtitle: 'oops' };
		expect(issuesFor(deck)).toContain('subtitle');
	});

	it('rejects empty text after trimming', () => {
		const deck = validDeck();
		deck.questions[0].prompt = '   ';
		expect(issuesFor(deck)).toContain('questions.0.prompt');
	});

	it('formats a root-level issue with (root) as its location', () => {
		expect(issuesFor('not a deck')).toContain('deck.yaml: (root):');
	});
});

describe('repeatsFollowUpAnswer', () => {
	it('matches a contiguous 6-word slice', () => {
		expect(
			repeatsFollowUpAnswer(
				'You would still need to repeatedly remove and re-insert overlapping intervals as you expand.',
				'Repeated removals and re-insertions as the merged range grows'
			)
		).toBe(false);
		expect(
			repeatsFollowUpAnswer(
				'The heap holds all n scores, so the bound is the whole input.',
				'The heap holds all n scores and nothing is dropped'
			)
		).toBe(true);
	});

	it('ignores a shared phrase shorter than 6 words when the option is longer', () => {
		expect(
			repeatsFollowUpAnswer(
				'Sorting the array is O(n log n) before the scan.',
				'The sort costs O(n log n) and then a linear scan finishes the job'
			)
		).toBe(false);
	});

	it('matches a whole option that is shorter than 6 words', () => {
		expect(repeatsFollowUpAnswer('Use a hash map as a key here.', 'a hash map')).toBe(true);
		expect(repeatsFollowUpAnswer('Use a tree.', 'a hash map')).toBe(false);
	});
});
