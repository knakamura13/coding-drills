import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { deckSchema, formatIssues, isTapCellQuestion, repeatsFollowUpAnswer, type ChoiceQuestion, type Deck } from './schema.ts';

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

function choice(deck: Deck): ChoiceQuestion {
	const question = deck.questions[0];
	if (!question || question.format === 'tap-cell') throw new Error('expected a choice question');
	return question;
}

describe('deckSchema', () => {
	it('accepts a deck where every wrong option has a follow-up', () => {
		expect(deckSchema.safeParse(validDeck()).success).toBe(true);
	});

	it('rejects a wrong option without a follow-up and names it', () => {
		const deck = validDeck();
		delete choice(deck).followUps['wrong-b'];
		expect(issuesFor(deck)).toContain('wrong option "wrong-b" has no follow-up');
	});

	it('rejects a follow-up attached to the correct option', () => {
		const deck = validDeck();
		choice(deck).followUps['right'] = choice(deck).followUps['wrong-a'];
		expect(issuesFor(deck)).toContain('the correct option "right" must not have a follow-up');
	});

	it('rejects a follow-up keyed by an id that is not an option', () => {
		const deck = validDeck();
		choice(deck).followUps['ghost'] = choice(deck).followUps['wrong-a'];
		expect(issuesFor(deck)).toContain('follow-up key "ghost" is not an option id');
	});

	it('rejects a correct id that is not an option', () => {
		const deck = validDeck();
		choice(deck).correct = 'missing';
		expect(issuesFor(deck)).toContain('"missing" is not one of the option ids');
	});

	it('rejects duplicate option ids and duplicate option text', () => {
		const deck = validDeck();
		choice(deck).options[2] = { ...choice(deck).options[1] };
		const issues = issuesFor(deck);
		expect(issues).toContain('duplicate option id "wrong-a"');
		expect(issues).toContain('duplicate option text');
	});

	it('rejects a follow-up whose correct id is not one of its options', () => {
		const deck = validDeck();
		choice(deck).followUps['wrong-a'].correct = 'z';
		expect(issuesFor(deck)).toContain('"z" is not one of the option ids');
	});

	it('rejects duplicate ids inside a follow-up', () => {
		const deck = validDeck();
		choice(deck).followUps['wrong-a'].options[1] = { id: 'x', text: 'Reason X' };
		const issues = issuesFor(deck);
		expect(issues).toContain('duplicate option id "x"');
		expect(issues).toContain('duplicate option text');
	});

	it('rejects duplicate question ids', () => {
		const deck = validDeck();
		deck.questions.push(structuredClone(choice(deck)));
		expect(issuesFor(deck)).toContain('duplicate question id "sample-question"');
	});

	it('rejects questions with fewer than two options', () => {
		const deck = validDeck();
		choice(deck).options = choice(deck).options.slice(0, 1);
		choice(deck).followUps = {};
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
		choice(deck).prompt = '   ';
		expect(issuesFor(deck)).toContain('questions.0.prompt');
	});

	it('formats a root-level issue with (root) as its location', () => {
		expect(issuesFor('not a deck')).toContain('deck.yaml: (root):');
	});

	it('rejects an explanation that repeats the follow-up answer', () => {
		const deck = validDeck();
		choice(deck).options[1].explanation =
			'Wrong A fails because Reason X is the one you needed here today';
		choice(deck).followUps['wrong-a'].options[0].text =
			'Reason X is the one you needed here today';
		const result = deckSchema.safeParse(deck);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(formatIssues('sample.yaml', result.error.issues)).toContain(
				'questions.0.options.1.explanation'
			);
		}
	});

	it('accepts an explicit choice format and still rejects tap fields on a choice question', () => {
		const deck = validDeck();
		choice(deck).format = 'choice';
		expect(deckSchema.safeParse(deck).success).toBe(true);
		(choice(deck) as { code?: string }).code = 'x = 1';
		expect(issuesFor(deck)).toContain('code');
	});
});

const TAP_DECK = {
	id: 'tap-sample',
	title: 'Tap sample',
	description: 'One tap-cell question.',
	questions: [
		{
			format: 'tap-cell' as const,
			id: 'read-cell',
			prompt: 'Which cell does `nums[1]` read?',
			code: 'nums = [3, 0, 1, 2]\nprint(nums[1])',
			sequence: { kind: 'array' as const, name: 'nums', cells: [3, 0, 1, 2] },
			markers: [{ name: 'i', at: 0 }],
			correct: 1,
			explanation: 'Position 1 is the second cell, and it holds 0.',
			misses: [
				{ index: 0, explanation: 'Counting from 1 lands here.' },
				{ index: 2, explanation: 'The brackets do not search for a value.' },
				{ index: 3, explanation: 'This is the last cell, not position 1.' }
			]
		}
	]
};

function tapDeck() {
	return structuredClone(TAP_DECK) as {
		questions: Array<{
			format: 'tap-cell';
			sequence: { kind: 'array' | 'string'; name?: string; cells: (string | number)[]; pastEnd?: boolean };
			markers?: { name: string; at: number }[];
			correct: number;
			misses: { index: number; explanation: string }[];
			followUps?: unknown;
		}>;
	};
}

describe('tap-cell questions', () => {
	it('coerces numeric cells to strings and keeps the correct index', () => {
		const result = deckSchema.safeParse(tapDeck());
		expect(result.success).toBe(true);
		if (!result.success) return;
		const question = result.data.questions[0];
		expect(isTapCellQuestion(question)).toBe(true);
		if (!isTapCellQuestion(question)) return;
		expect(question.sequence.cells).toEqual(['3', '0', '1', '2']);
		expect(question.correct).toBe(1);
		expect(question.markers?.[0]).toEqual({ name: 'i', at: 0 });
	});

	it('reads the same shape from YAML', () => {
		const raw = parse(`
id: tap-sample
title: Tap sample
description: One tap-cell question.
questions:
  - format: tap-cell
    id: read-cell
    prompt: Which cell?
    code: |
      nums = [3, 0, 1, 2]
    sequence:
      kind: array
      name: nums
      cells: [3, 0, 1, 2]
    correct: 1
    explanation: The second cell holds 0.
    misses:
      - { index: 0, explanation: Counted from 1. }
      - { index: 2, explanation: Searched for 1. }
      - { index: 3, explanation: Read the last cell. }
`);
		const result = deckSchema.safeParse(raw);
		expect(result.success).toBe(true);
		if (!result.success || !isTapCellQuestion(result.data.questions[0])) return;
		expect(result.data.questions[0].sequence.cells).toEqual(['3', '0', '1', '2']);
		expect(result.data.questions[0].code).toBe('nums = [3, 0, 1, 2]');
	});

	it('rejects a miss on the correct cell and a cell with no explanation', () => {
		const extra = tapDeck();
		extra.questions[0].misses.push({ index: 1, explanation: 'The right cell has no miss.' });
		expect(issuesFor(extra)).toContain('the correct index 1 must not have a miss');

		const missing = tapDeck();
		missing.questions[0].misses = missing.questions[0].misses.filter((miss) => miss.index !== 2);
		expect(issuesFor(missing)).toContain('index 2 has no explanation');
	});

	it('requires an explanation for a past-the-end cell and rejects a string cell that is not one character', () => {
		const deck = tapDeck();
		deck.questions[0].sequence.pastEnd = true;
		expect(issuesFor(deck)).toContain('index 4 has no explanation');

		const letters = tapDeck();
		letters.questions[0].sequence = { kind: 'string', cells: ['z', 'ip'] };
		letters.questions[0].misses = [{ index: 0, explanation: 'Not this one.' }];
		letters.questions[0].correct = 1;
		expect(issuesFor(letters)).toContain('a string cell must be a single character');
	});

	it('rejects a duplicated marker name, a marker past the end, and choice-only keys', () => {
		const deck = tapDeck();
		deck.questions[0].markers = [
			{ name: 'left', at: 0 },
			{ name: 'left', at: 1 },
			{ name: 'right', at: 8 }
		];
		const issues = issuesFor(deck);
		expect(issues).toContain('duplicate marker name "left"');
		expect(issues).toContain('marker "right" is outside the sequence');

		const mixed = tapDeck();
		(mixed.questions[0] as { followUps?: unknown }).followUps = {};
		expect(issuesFor(mixed)).toContain('followUps');
	});

	it('rejects a correct index outside the sequence', () => {
		const deck = tapDeck();
		deck.questions[0].correct = 9;
		expect(issuesFor(deck)).toContain('correct index 9 is outside the sequence');
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
