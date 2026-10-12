import { describe, expect, it } from 'vitest';
import { loadDecks } from '../content/loadDecks.ts';
import type { Deck } from '../content/schema.ts';
import {
	advance,
	check,
	createLesson,
	createReviewLesson,
	isFinished,
	isPristine,
	progress,
	select,
	summarize,
	view,
	type LessonState
} from './lesson';
import { seededRng, shuffled } from './shuffle';

function tinyDeck(): Deck {
	return {
		id: 'tiny',
		title: 'Tiny',
		description: 'Two questions.',
		heading: 'Deck heading',
		questions: [
			{
				id: 'q1',
				prompt: 'First problem.',
				options: [
					{ id: 'right', text: 'Right', explanation: 'Why right.' },
					{ id: 'a', text: 'Wrong A', explanation: 'Why A is wrong.' },
					{ id: 'b', text: 'Wrong B', explanation: 'Why B is wrong.' }
				],
				correct: 'right',
				followUps: {
					a: {
						prompt: 'Follow-up for A?',
						options: [
							{ id: 'fa-good', text: 'Good' },
							{ id: 'fa-bad', text: 'Bad' }
						],
						correct: 'fa-good',
						explanation: 'A explained.'
					},
					b: {
						prompt: 'Follow-up for B?',
						options: [
							{ id: 'fb-good', text: 'Good' },
							{ id: 'fb-bad', text: 'Bad' }
						],
						correct: 'fb-good',
						explanation: 'B explained.'
					}
				}
			},
			{
				id: 'q2',
				heading: 'Question heading',
				prompt: 'Second problem.',
				options: [
					{ id: 'yes', text: 'Yes', explanation: 'Why yes.' },
					{ id: 'no', text: 'No', explanation: 'Why no.' }
				],
				correct: 'yes',
				followUps: {
					no: {
						prompt: 'Follow-up for no?',
						options: [
							{ id: 'fn-good', text: 'Good' },
							{ id: 'fn-bad', text: 'Bad' }
						],
						correct: 'fn-good',
						explanation: 'No explained.'
					}
				}
			}
		]
	};
}

/** Plays one lesson with a fixed question order so assertions can name questions. */
function start(deck = tinyDeck()): LessonState {
	const state = createLesson(deck, seededRng(1));
	// Put q1 first regardless of the shuffle, keeping option orders intact.
	const plan = [...state.plan].sort((x, y) => x.question.id.localeCompare(y.question.id));
	return { ...state, plan };
}

function answer(state: LessonState, optionId: string): LessonState {
	return check(select(state, optionId));
}

describe('createLesson', () => {
	const deck = loadDecks('content/decks')[0];

	it('plans every question once with permuted option orders', () => {
		const state = createLesson(deck, seededRng(3));
		expect(state.plan.map((p) => p.question.id).sort()).toEqual(deck.questions.map((q) => q.id).sort());
		for (const planned of state.plan) {
			expect([...planned.optionOrder].sort()).toEqual(planned.question.options.map((o) => o.id).sort());
			const wrong = planned.question.options.filter((o) => o.id !== planned.question.correct);
			expect(Object.keys(planned.followUpOrders).sort()).toEqual(wrong.map((o) => o.id).sort());
			for (const [optionId, order] of Object.entries(planned.followUpOrders)) {
				expect([...order].sort()).toEqual(
					planned.question.followUps[optionId].options.map((o) => o.id).sort()
				);
			}
		}
	});

	it('is reproducible for a seed and varies across seeds', () => {
		const first = createLesson(deck, seededRng(11));
		const again = createLesson(deck, seededRng(11));
		expect(first.plan.map((p) => [p.question.id, p.optionOrder])).toEqual(
			again.plan.map((p) => [p.question.id, p.optionOrder])
		);
		const orders = new Set(
			Array.from({ length: 12 }, (_, seed) =>
				createLesson(deck, seededRng(seed))
					.plan.map((p) => p.question.id)
					.join(',')
			)
		);
		expect(orders.size).toBeGreaterThan(1);
	});

	it('starts pristine, unfinished, at zero progress', () => {
		const state = createLesson(deck, seededRng(1));
		expect(isFinished(state)).toBe(false);
		expect(isPristine(state)).toBe(true);
		expect(progress(state)).toBe(0);
		expect(state.completed).toEqual([]);
	});
});

describe('shuffled', () => {
	it('does not mutate its input and keeps every item', () => {
		const items = [1, 2, 3, 4, 5];
		const result = shuffled(items, seededRng(5));
		expect(items).toEqual([1, 2, 3, 4, 5]);
		expect([...result].sort()).toEqual(items);
	});

	it('defaults to Math.random', () => {
		expect(shuffled([1, 2, 3])).toHaveLength(3);
	});
});

describe('select and check', () => {
	it('ignores an option id that is not on screen', () => {
		const state = start();
		expect(select(state, 'fa-good')).toBe(state);
		expect(select(state, 'nope')).toBe(state);
	});

	it('records a selection, which makes the lesson no longer pristine', () => {
		const state = select(start(), 'a');
		expect(state.selected).toBe('a');
		expect(isPristine(state)).toBe(false);
	});

	it('requires a selection before checking', () => {
		const state = start();
		expect(check(state)).toBe(state);
	});

	it('locks the selection once checked', () => {
		const checked = answer(start(), 'a');
		expect(checked.checked).toBe(true);
		expect(select(checked, 'b')).toBe(checked);
		expect(select(checked, 'b', true)).toBe(checked);
		expect(check(checked)).toBe(checked);
	});

	it('checks on select when immediate feedback is on', () => {
		const checked = select(start(), 'a', true);
		expect(checked.checked).toBe(true);
		expect(checked.selected).toBe('a');
		expect(view(checked)!.verdict?.correct).toBe(false);
	});

	it('does not advance before checking', () => {
		const selected = select(start(), 'right');
		expect(advance(selected)).toBe(selected);
		const fresh = start();
		expect(advance(fresh)).toBe(fresh);
	});
});

describe('a correct answer', () => {
	it('completes the question without a follow-up', () => {
		const next = advance(answer(start(), 'right'));
		expect(next.completed).toEqual([{ deckId: 'tiny', questionId: 'q1', pickedId: 'right', correct: true }]);
		expect(next.cursor).toBe(1);
		expect(next.stage).toBe('question');
		expect(next.selected).toBeNull();
		expect(next.checked).toBe(false);
	});

	it('explains itself inline', () => {
		const verdict = view(answer(start(), 'right'))!.verdict!;
		expect(verdict).toEqual({ correct: true, correctText: 'Right', explanation: 'Why right.' });
		expect(view(answer(start(), 'right'))!.seeWhy).toBeNull();
	});
});

describe('a wrong answer', () => {
	it('is always followed by the follow-up for the option picked', () => {
		const afterA = advance(answer(start(), 'a'));
		expect(afterA.stage).toBe('followUp');
		expect(afterA.mainPick).toBe('a');
		expect(afterA.cursor).toBe(0);
		expect(view(afterA)!.followUpPrompt).toBe('Follow-up for A?');

		const afterB = advance(answer(start(), 'b'));
		expect(view(afterB)!.followUpPrompt).toBe('Follow-up for B?');
	});

	it('hides the explanation behind See why again and names both options', () => {
		const wrong = view(answer(start(), 'a'))!;
		expect(wrong.verdict).toEqual({ correct: false, correctText: 'Right', explanation: '' });
		expect(wrong.seeWhy).toEqual({
			pickedText: 'Wrong A',
			pickedExplanation: 'Why A is wrong.',
			correctText: 'Right',
			correctExplanation: 'Why right.'
		});
	});

	it('keeps the original problem pinned during the follow-up', () => {
		const followUp = view(advance(answer(start(), 'a')))!;
		expect(followUp.prompt).toBe('First problem.');
		expect(followUp.stage).toBe('followUp');
		expect(followUp.seeWhy).toBeNull();
		expect(followUp.canCheck).toBe(false);
	});

	it('counts half a question of progress when the follow-up begins', () => {
		const followUp = advance(answer(start(), 'a'));
		expect(progress(followUp)).toBe(0.25);
	});

	it('completes with the follow-up result, right or wrong', () => {
		const rightFollowUp = advance(answer(advance(answer(start(), 'a')), 'fa-good'));
		expect(rightFollowUp.completed).toEqual([
			{
				deckId: 'tiny',
				questionId: 'q1',
				pickedId: 'a',
				correct: false,
				followUp: { pickedId: 'fa-good', correct: true }
			}
		]);
		const wrongFollowUp = advance(answer(advance(answer(start(), 'b')), 'fb-bad'));
		expect(wrongFollowUp.completed[0].followUp).toEqual({ pickedId: 'fb-bad', correct: false });
		expect(wrongFollowUp.cursor).toBe(1);
	});

	it('shows the follow-up explanation whether or not the follow-up was right', () => {
		const inFollowUp = advance(answer(start(), 'a'));
		expect(view(answer(inFollowUp, 'fa-good'))!.verdict).toEqual({
			correct: true,
			correctText: 'Good',
			explanation: 'A explained.'
		});
		expect(view(answer(inFollowUp, 'fa-bad'))!.verdict).toEqual({
			correct: false,
			correctText: 'Good',
			explanation: 'A explained.'
		});
	});

	it('still leaves a wrong answer only through its follow-up when feedback is immediate', () => {
		const checked = select(start(), 'a', true);
		const followUp = advance(checked);
		expect(followUp.stage).toBe('followUp');
		expect(followUp.completed).toEqual([]);
		const done = advance(select(followUp, 'fa-good', true));
		expect(done.completed[0].followUp).toEqual({ pickedId: 'fa-good', correct: true });
		expect(done.stage).toBe('question');
	});

	it('never nests a second follow-up', () => {
		const done = advance(answer(advance(answer(start(), 'a')), 'fa-bad'));
		expect(done.stage).toBe('question');
		expect(done.mainPick).toBeNull();
	});
});

describe('view', () => {
	it('marks selected, then correct and wrong, once checked', () => {
		const selected = view(select(start(), 'a'))!;
		expect(selected.options.find((o) => o.id === 'a')!.state).toBe('selected');
		expect(selected.canCheck).toBe(true);
		expect(selected.verdict).toBeNull();

		const checked = view(answer(start(), 'a'))!;
		const states = Object.fromEntries(checked.options.map((o) => [o.id, o.state]));
		expect(states).toEqual({ right: 'correct', a: 'wrong', b: 'idle' });
		expect(checked.canCheck).toBe(false);
	});

	it('marks a right pick as correct and leaves the rest idle', () => {
		const states = Object.fromEntries(view(answer(start(), 'right'))!.options.map((o) => [o.id, o.state]));
		expect(states).toEqual({ right: 'correct', a: 'idle', b: 'idle' });
	});

	it('resolves the heading from the question, then the deck, then nothing', () => {
		const first = start();
		expect(view(first)!.heading).toBe('Deck heading');
		const second = advance(answer(first, 'right'));
		expect(view(second)!.heading).toBe('Question heading');

		const noHeading = { ...tinyDeck(), heading: undefined };
		expect(view(start(noHeading))!.heading).toBeUndefined();
	});

	it('reports position and total', () => {
		const state = start();
		expect(view(state)).toMatchObject({ position: 1, total: 2 });
		expect(view(advance(answer(state, 'right')))).toMatchObject({ position: 2, total: 2 });
	});

	it('is null once the lesson is finished', () => {
		const finished = advance(answer(advance(answer(start(), 'right')), 'yes'));
		expect(view(finished)).toBeNull();
	});
});

describe('finishing', () => {
	function finishedState(): LessonState {
		let state = start();
		state = advance(answer(state, 'a')); // q1 wrong -> follow-up
		state = advance(answer(state, 'fa-good')); // follow-up right
		state = advance(answer(state, 'no')); // q2 wrong -> follow-up
		state = advance(answer(state, 'fn-bad')); // follow-up wrong
		return state;
	}

	it('ends after the last question and ignores further input', () => {
		const state = finishedState();
		expect(isFinished(state)).toBe(true);
		expect(progress(state)).toBe(1);
		expect(select(state, 'yes')).toBe(state);
		expect(check(state)).toBe(state);
		expect(advance(state)).toBe(state);
	});

	it('summarizes first-try results and follow-ups', () => {
		expect(summarize(finishedState())).toEqual({
			total: 2,
			correctFirstTry: 0,
			followUpsAttempted: 2,
			followUpsCorrect: 1,
			missed: [
				{
					questionId: 'q1',
					prompt: 'First problem.',
					pickedText: 'Wrong A',
					correctText: 'Right',
					followUpCorrect: true
				},
				{
					questionId: 'q2',
					prompt: 'Second problem.',
					pickedText: 'No',
					correctText: 'Yes',
					followUpCorrect: false
				}
			]
		});
	});

	it('counts first-try answers and omits them from the missed list', () => {
		let state = start();
		state = advance(answer(state, 'right'));
		state = advance(answer(state, 'yes'));
		expect(summarize(state)).toEqual({
			total: 2,
			correctFirstTry: 2,
			followUpsAttempted: 0,
			followUpsCorrect: 0,
			missed: []
		});
	});

	it('treats an empty plan as complete', () => {
		const empty = { ...start(), plan: [] };
		expect(isFinished(empty)).toBe(true);
		expect(progress(empty)).toBe(1);
	});
});

describe('random play over the shipped decks', () => {
	const decks = loadDecks('content/decks');

	it('always terminates with one completion per question and a follow-up for every miss', () => {
		for (const deck of decks) {
			for (let seed = 1; seed <= 60; seed++) {
				const rng = seededRng(seed);
				let state = createLesson(deck, rng);
				let steps = 0;
				let lastProgress = 0;
				while (!isFinished(state)) {
					const current = view(state)!;
					const pick = current.options[Math.floor(rng() * current.options.length)];
					state = advance(check(select(state, pick.id)));
					const now = progress(state);
					expect(now).toBeGreaterThanOrEqual(lastProgress);
					lastProgress = now;
					steps += 1;
					expect(steps).toBeLessThanOrEqual(deck.questions.length * 2);
				}
				expect(state.completed).toHaveLength(deck.questions.length);
				for (const done of state.completed) {
					expect(done.followUp !== undefined).toBe(!done.correct);
				}
				const summary = summarize(state);
				expect(summary.followUpsAttempted).toBe(summary.total - summary.correctFirstTry);
				expect(lastProgress).toBe(1);
			}
		}
	});
});

describe('createReviewLesson', () => {
	const alpha = { ...tinyDeck(), id: 'alpha', heading: 'Alpha heading' };
	const beta = { ...tinyDeck(), id: 'beta', heading: undefined };
	const entries = [
		{ deckId: 'alpha', heading: alpha.heading, question: alpha.questions[0] },
		{ deckId: 'beta', heading: beta.heading, question: beta.questions[0] }
	];

	it('plans questions from several decks, even when their ids collide', () => {
		const state = createReviewLesson(entries, seededRng(1));
		expect(state.deckId).toBe('review');
		expect(state.plan.map((planned) => `${planned.deckId}/${planned.question.id}`).sort()).toEqual([
			'alpha/q1',
			'beta/q1'
		]);
	});

	it('records the deck each question came from and keeps a deck heading per question', () => {
		let state = createReviewLesson(entries, seededRng(1));
		const headings: Record<string, string | undefined> = {};
		while (!isFinished(state)) {
			const current = view(state)!;
			headings[state.plan[state.cursor].deckId] = current.heading;
			state = advance(answer(state, state.plan[state.cursor].question.correct));
		}
		expect(headings).toEqual({ alpha: 'Alpha heading', beta: undefined });
		expect(state.completed.map((done) => done.deckId).sort()).toEqual(['alpha', 'beta']);
	});

	it('summarizes a miss on each deck separately', () => {
		let state = createReviewLesson(entries, seededRng(1));
		while (!isFinished(state)) {
			const { question } = state.plan[state.cursor];
			state = advance(answer(state, question.options.find((o) => o.id !== question.correct)!.id));
			const followUp = question.followUps[state.mainPick!];
			state = advance(answer(state, followUp.correct));
		}
		const summary = summarize(state);
		expect(summary.missed).toHaveLength(2);
		expect(summary.followUpsCorrect).toBe(2);
	});
});
