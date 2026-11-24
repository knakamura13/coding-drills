import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { deckSchema, formatIssues, isChoiceQuestion, isDragPointersQuestion, isStepTraceQuestion, isTapCellQuestion, repeatsFollowUpAnswer, workedExampleIssue, type ChoiceQuestion, type Deck } from './schema.ts';

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
	if (!question || !isChoiceQuestion(question)) throw new Error('expected a choice question');
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

function dragDeck() {
	return {
		id: 'drag-sample',
		title: 'Drag sample',
		description: 'One drag-pointers question.',
		questions: [
			{
				format: 'drag-pointers' as const,
				id: 'move-ends',
				prompt: 'Where do `l` and `r` sit after one step?',
				code: 'l += 1',
				sequence: { kind: 'array' as const, name: 'nums', cells: [1, 4, 6, 8] },
				markers: [{ name: 'i', at: 0 }] as { name: string; at: number }[],
				pointers: [
					{
						name: 'l',
						start: 0,
						correct: 1,
						explanation: 'Too small, so l moves.',
						misses: [{ index: 2, explanation: 'One step is one cell.' }] as { index: number; explanation: string }[],
						elsewhere: 'l moves one cell.'
					},
					{ name: 'r', start: 3, correct: 3, explanation: 'r stays.', elsewhere: 'r stays when the sum is too small.' }
				]
			}
		]
	};
}

describe('drag-pointers questions', () => {
	it('accepts a question where one pointer moves and another stays', () => {
		const result = deckSchema.safeParse(dragDeck());
		expect(result.success).toBe(true);
		if (!result.success) return;
		const question = result.data.questions[0];
		expect(isDragPointersQuestion(question)).toBe(true);
		expect(isChoiceQuestion(question)).toBe(false);
		expect(isTapCellQuestion(question)).toBe(false);
	});

	it('rejects a question where no pointer has to move', () => {
		const deck = dragDeck();
		deck.questions[0].pointers[0]!.start = 1;
		expect(issuesFor(deck)).toContain('at least one pointer must have to move');
	});

	it('rejects a pointer or marker outside the sequence, and a miss on the right cell', () => {
		const deck = dragDeck();
		deck.questions[0].pointers[0]!.correct = 9;
		deck.questions[0].pointers[1]!.start = 7;
		deck.questions[0].markers = [{ name: 'i', at: 8 }];
		deck.questions[0].pointers[0]!.misses = [{ index: 10, explanation: 'No.' }];
		let issues = issuesFor(deck);
		expect(issues).toContain('"l" belongs outside the sequence');
		expect(issues).toContain('"r" starts outside the sequence');
		expect(issues).toContain('marker "i" is outside the sequence');
		expect(issues).toContain('miss index 10 is outside the sequence');

		const onRight = dragDeck();
		onRight.questions[0].pointers[0]!.misses!.push({ index: 1, explanation: 'The right cell has no miss.' });
		issues = issuesFor(onRight);
		expect(issues).toContain('the correct index 1 must not have a miss');
	});

	it('rejects a repeated name and requires an elsewhere explanation', () => {
		const deck = dragDeck();
		deck.questions[0].markers = [{ name: 'l', at: 0 }];
		expect(issuesFor(deck)).toContain('duplicate pointer or marker name "l"');

		const bare = dragDeck();
		delete (bare.questions[0].pointers[0] as { elsewhere?: string }).elsewhere;
		expect(issuesFor(bare)).toContain('elsewhere');
	});

	it('draws at most 8 cells', () => {
		const deck = dragDeck();
		deck.questions[0].sequence.cells = [1, 2, 3, 4, 5, 6, 7, 8, 9];
		expect(issuesFor(deck)).toContain('a drag question draws at most 8 cells');
	});
});

function traceDeck() {
	return {
		id: 'trace-sample',
		title: 'Trace sample',
		description: 'One step-trace question.',
		questions: [
			{
				format: 'step-trace' as const,
				id: 'trace-sum',
				prompt: 'Trace the scan.',
				code: 'a = 1\nb = 2\nc = 3',
				sequence: { kind: 'array' as const, name: 'nums', cells: [1, 4, 6, 8] },
				start: [{ name: 'l', at: 0 }] as { name: string; at: number }[],
				steps: [
					{
						line: 1,
						ask: 'Where does `l` sit?',
						pointer: 'l',
						correct: 1,
						explanation: 'It moves.',
						misses: [{ index: 3, explanation: 'Not the end.' }] as { index: number; explanation: string }[],
						elsewhere: 'One cell.'
					},
					{
						line: 2,
						ask: 'What is the sum?',
						options: [
							{ id: 'ten', text: '10', explanation: 'No.' },
							{ id: 'twelve', text: '12', explanation: 'Yes.' }
						],
						correct: 'twelve'
					}
				] as Array<Record<string, unknown>>
			}
		]
	};
}

describe('step-trace questions', () => {
	it('accepts cell steps and choice steps in one trace', () => {
		const result = deckSchema.safeParse(traceDeck());
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(isStepTraceQuestion(result.data.questions[0])).toBe(true);
		expect(isChoiceQuestion(result.data.questions[0])).toBe(false);
	});

	it('rejects a line past the code, an unknown pointer, and a miss on the right cell', () => {
		const deck = traceDeck();
		deck.questions[0].steps[0]!.line = 9;
		deck.questions[0].steps[0]!.pointer = 'r';
		(deck.questions[0].steps[0]!.misses as { index: number; explanation: string }[]).push({ index: 1, explanation: 'The right cell.' });
		const issues = issuesFor(deck);
		expect(issues).toContain('line 9 is past the end of the code (3 lines)');
		expect(issues).toContain('"r" is not a pointer in start');
		expect(issues).toContain('the correct index 1 must not have a miss');
	});

	it('rejects a choice step whose correct id is not an option, and repeated options', () => {
		const deck = traceDeck();
		deck.questions[0].steps[1]!.correct = 'nine';
		expect(issuesFor(deck)).toContain('"nine" is not one of the option ids');
		const twins = traceDeck();
		(twins.questions[0].steps[1]!.options as { id: string; text: string; explanation: string }[])[1] = {
			id: 'twelve',
			text: '10',
			explanation: 'Same text.'
		};
		expect(issuesFor(twins)).toContain('duplicate option');
	});

	it('needs two to five steps and at most 8 cells', () => {
		const one = traceDeck();
		one.questions[0].steps = one.questions[0].steps.slice(0, 1);
		expect(issuesFor(one)).toContain('steps');
		const wide = traceDeck();
		wide.questions[0].sequence.cells = [1, 2, 3, 4, 5, 6, 7, 8, 9];
		expect(issuesFor(wide)).toContain('a trace draws at most 8 cells');
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

describe('workedExampleIssue', () => {
	const setup = 'Consider `a = [3, 8]`.';

	it('accepts a setup paragraph then two to four steps numbered from 1', () => {
		expect(workedExampleIssue(`${setup}\n\n1. One.\n2. Two.`)).toBeNull();
		expect(workedExampleIssue(`${setup}\n\n\`\`\`\nx = 1\n\`\`\`\n\n1. One.\n   Wraps.\n2. Two.\n3. Three.\n4. Four.`)).toBeNull();
	});

	it('names what breaks the shape', () => {
		expect(workedExampleIssue(setup)).toMatch(/numbered steps/);
		expect(workedExampleIssue('1. One.\n2. Two.')).toMatch(/setup paragraph/);
		expect(workedExampleIssue(`${setup}\n\n1. One.\n2. Two.\n\nSo it works.`)).toMatch(/last step/);
		expect(workedExampleIssue(`${setup}\n\n1. One.`)).toMatch(/1 steps/);
		expect(workedExampleIssue(`${setup}\n\n1. A\n2. B\n3. C\n4. D\n5. E`)).toMatch(/5 steps/);
		expect(workedExampleIssue(`${setup}\n\n1. One.\n3. Two.`)).toMatch(/in order/);
		// A wrapped setup line that starts with a number is text, not a step.
		expect(workedExampleIssue('Merge the two lists of length\n4. Then:\n\n1. One.\n2. Two.')).toBeNull();
		expect(workedExampleIssue(`${setup}\n\n1. One.\n2. Two.\n\nMore.\n\n1. Again.\n2. Again.`)).toMatch(/more than one list/);
	});

	it('fails a deck whose worked example has steps in the wrong shape', () => {
		const deck = parse(`
id: d
title: D
questions:
  - id: q
    workedExample: |-
      Setup.

      1. Only one step.
    prompt: Which?
    options:
      - { id: a, text: A, explanation: Right. }
      - { id: b, text: B, explanation: Wrong. }
    correct: a
    followUps:
      b: { prompt: Why?, options: [{ id: x, text: X }, { id: y, text: Y }], correct: x }
`);
		const result = deckSchema.safeParse(deck);
		expect(result.success).toBe(false);
		expect(formatIssues('d.yaml', result.error?.issues ?? [])).toMatch(/worked example has 1 steps/);
	});
});
