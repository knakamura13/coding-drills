import { describe, expect, it } from 'vitest';
import { loadDecks } from '../content/loadDecks.ts';
import { isChoiceQuestion, isDragPointersQuestion, isStepTraceQuestion, isTapCellQuestion, type Deck, type DragPointersQuestion, type StepTraceQuestion, type TapCellQuestion } from '../content/schema.ts';
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
			const question = planned.question;
			if (!isChoiceQuestion(question)) throw new Error(`expected choice questions in ${deck.id}`);
			expect([...planned.optionOrder].sort()).toEqual(question.options.map((o) => o.id).sort());
			const wrong = question.options.filter((o) => o.id !== question.correct);
			expect(Object.keys(planned.followUpOrders).sort()).toEqual(wrong.map((o) => o.id).sort());
			for (const [optionId, order] of Object.entries(planned.followUpOrders)) {
				expect([...order].sort()).toEqual(question.followUps[optionId].options.map((o) => o.id).sort());
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

	it('names the wrong pick in the follow-up, for its recap card, and nowhere else', () => {
		const question = start().plan[0].question;
		if (!isChoiceQuestion(question)) throw new Error('fixture is multiple choice');
		expect(view(advance(answer(start(), 'a')))!.mainPickText).toBe(question.options.find((option) => option.id === 'a')!.text);
		expect(view(start())!.mainPickText).toBeNull();
		expect(view(answer(start(), 'a'))!.mainPickText).toBeNull();
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

	// Every deck is played 60 times, so this grows with the content. It took over 5 s on a CI runner with coverage on.

	it('always terminates with one completion per question and a follow-up for every miss', () => {
		for (const deck of decks) {
			for (let seed = 1; seed <= 60; seed++) {
				const rng = seededRng(seed);
				let state = createLesson(deck, rng);
				let steps = 0;
				let lastProgress = 0;
				while (!isFinished(state)) {
					const current = view(state)!;
					const planned = state.plan[state.cursor].question;
					const ids = current.board
						? current.board.cells.map((cell) => cell.id)
						: current.options.map((option) => option.id);
					// A drag answer places every pointer on some cell.
					const pick = isDragPointersQuestion(planned)
						? planned.pointers.map((pointer) => `${pointer.name}=${Math.floor(rng() * ids.length)}`).join(',')
						: isStepTraceQuestion(planned)
							? (() => {
									const offered = state.plan[state.cursor].stepOrders[state.picks.length];
									return offered[Math.floor(rng() * offered.length)];
								})()
							: ids[Math.floor(rng() * ids.length)];
					if (!pick) throw new Error('nothing to pick');
					state = advance(check(select(state, pick)));
					const now = progress(state);
					expect(now).toBeGreaterThanOrEqual(lastProgress);
					lastProgress = now;
					steps += 1;
					expect(steps).toBeLessThanOrEqual(deck.questions.length * 6);
				}
				expect(state.completed).toHaveLength(deck.questions.length);
				let choiceMisses = 0;
				for (const done of state.completed) {
					const question = deck.questions.find((item) => item.id === done.questionId)!;
					if (isTapCellQuestion(question) || isDragPointersQuestion(question) || isStepTraceQuestion(question)) expect(done.followUp).toBeUndefined();
					else if (done.correct) expect(done.followUp).toBeUndefined();
					else {
						choiceMisses += 1;
						expect(done.followUp).toBeDefined();
					}
				}
				const summary = summarize(state);
				expect(summary.followUpsAttempted).toBe(choiceMisses);
				expect(lastProgress).toBe(1);
			}
		}
	}, 60_000);
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
			const question = state.plan[state.cursor].question;
			if (!isChoiceQuestion(question)) throw new Error('expected a choice question');
			headings[state.plan[state.cursor].deckId] = current.heading;
			state = advance(answer(state, question.correct));
		}
		expect(headings).toEqual({ alpha: 'Alpha heading', beta: undefined });
		expect(state.completed.map((done) => done.deckId).sort()).toEqual(['alpha', 'beta']);
	});

	it('summarizes a miss on each deck separately', () => {
		let state = createReviewLesson(entries, seededRng(1));
		while (!isFinished(state)) {
			const { question } = state.plan[state.cursor];
			if (!isChoiceQuestion(question)) throw new Error('expected a choice question');
			state = advance(answer(state, question.options.find((o) => o.id !== question.correct)!.id));
			const followUp = question.followUps[state.mainPick!];
			state = advance(answer(state, followUp.correct));
		}
		const summary = summarize(state);
		expect(summary.missed).toHaveLength(2);
		expect(summary.followUpsCorrect).toBe(2);
	});
});

function tapQuestion(): TapCellQuestion {
	return {
		format: 'tap-cell',
		id: 'read-cell',
		prompt: 'Which cell does nums[1] read?',
		code: 'nums = [3, 0, 1, 2]',
		sequence: { kind: 'array', name: 'nums', cells: ['3', '0', '1', '2'] },
		markers: [{ name: 'i', at: 0 }],
		correct: 1,
		explanation: 'The second cell holds 0.',
		misses: [
			{ index: 0, explanation: 'Counted from 1.' },
			{ index: 2, explanation: 'Searched for the value.' },
			{ index: 3, explanation: 'Read the last cell.' }
		]
	};
}

function tapLesson(): Deck {
	return {
		id: 'tap-sample',
		title: 'Tap',
		description: 'Tap a cell.',
		heading: 'Tap the cell',
		questions: [tapQuestion()]
	};
}

describe('tap-cell lessons', () => {
	it('keeps cells in index order and does not invent follow-ups', () => {
		const first = createLesson(tapLesson(), seededRng(1));
		const second = createLesson(tapLesson(), seededRng(9));
		expect(first.plan[0].optionOrder).toEqual(['0', '1', '2', '3']);
		expect(second.plan[0].optionOrder).toEqual(first.plan[0].optionOrder);
		expect(first.plan[0].followUpOrders).toEqual({});
		expect(view(first)!.board?.cells[0].markers).toEqual(['i']);
		expect(view(first)!.code).toBe('nums = [3, 0, 1, 2]');
		expect(view(first)!.options).toEqual([]);
	});

	it('snaps a correct tap and finishes with no follow-up', () => {
		const checked = select(start(tapLesson()), '1', true);
		const seen = view(checked)!;
		expect(seen.board?.cells.map((cell) => cell.tone)).toEqual(['idle', 'correct', 'idle', 'idle']);
		expect(seen.board?.cells[1].reveal).toBe(false);
		expect(seen.verdict).toMatchObject({ correct: true, explanation: 'The second cell holds 0.' });
		expect(seen.seeWhy).toBeNull();
		const done = advance(checked);
		expect(done.completed).toEqual([
			{ deckId: 'tap-sample', questionId: 'read-cell', pickedId: '1', correct: true }
		]);
		expect(isFinished(done)).toBe(true);
	});

	it('highlights a wrong cell, explains it, and reveals the right cell before moving on', () => {
		const checked = select(start(tapLesson()), '0', true);
		const seen = view(checked)!;
		expect(seen.board?.cells.map((cell) => [cell.tone, cell.reveal])).toEqual([
			['wrong', false],
			['correct', true],
			['idle', false],
			['idle', false]
		]);
		expect(seen.board?.note).toBe('Counted from 1.');
		expect(seen.verdict?.correctText).toBe('index 1, `0`');
		const done = advance(checked);
		expect(done.stage).toBe('question');
		expect(done.completed[0]).toEqual({
			deckId: 'tap-sample',
			questionId: 'read-cell',
			pickedId: '0',
			correct: false
		});
		expect(summarize(done)).toMatchObject({
			total: 1,
			correctFirstTry: 0,
			followUpsAttempted: 0,
			followUpsCorrect: 0,
			missed: [
				{
					questionId: 'read-cell',
					pickedText: 'index 0, `3`',
					correctText: 'index 1, `0`',
					followUpCorrect: null
				}
			]
		});
	});

	it('ignores a pick that is not a cell', () => {
		const state = start(tapLesson());
		expect(select(state, 'nope', true)).toBe(state);
		expect(advance(answer(state, '9'))).toBe(answer(state, '9'));
	});
});

function dragQuestion(): DragPointersQuestion {
	return {
		format: 'drag-pointers',
		id: 'move-ends',
		prompt: 'Where do `l` and `r` sit after one step?',
		code: 'l += 1',
		sequence: { kind: 'array', name: 'nums', cells: ['1', '4', '6', '8'] },
		markers: [{ name: 'i', at: 0 }],
		pointers: [
			{
				name: 'l',
				start: 0,
				correct: 1,
				explanation: 'Too small, so l moves.',
				misses: [{ index: 2, explanation: 'One step is one cell.' }],
				elsewhere: 'l moves one cell.'
			},
			{ name: 'r', start: 3, correct: 3, explanation: 'r stays.', elsewhere: 'r stays when the sum is too small.' }
		]
	};
}

function dragLesson(): Deck {
	return { id: 'drag-sample', title: 'Drag', description: 'Drag pointers.', heading: 'Place the pointers', questions: [dragQuestion()] };
}

describe('drag-pointers lessons', () => {
	it('starts the pointers on their start cells and offers no options or follow-ups', () => {
		const first = createLesson(dragLesson(), seededRng(1));
		const seen = view(first)!;
		expect(seen.format).toBe('drag-pointers');
		expect(seen.options).toEqual([]);
		expect(seen.canCheck).toBe(false);
		expect(seen.board?.pointers.map((pointer) => [pointer.name, pointer.at, pointer.tone])).toEqual([
			['l', 0, 'idle'],
			['r', 3, 'idle']
		]);
		expect(seen.board?.cells[0].markers).toEqual(['i']);
		expect(first.plan[0].followUpOrders).toEqual({});
	});

	it('only accepts a whole placement, and waits for Check', () => {
		const state = start(dragLesson());
		expect(select(state, 'l=9,r=3', true)).toBe(state);
		expect(select(state, 'l=1', true)).toBe(state);
		const moved = select(state, 'l=1,r=3');
		expect(moved.checked).toBe(false);
		expect(view(moved)!.canCheck).toBe(true);
		expect(view(moved)!.board?.pointers[0]).toMatchObject({ name: 'l', at: 1, tone: 'idle' });
	});

	it('marks every pointer right and records one correct attempt', () => {
		const checked = check(select(start(dragLesson()), 'l=1,r=3'));
		const seen = view(checked)!;
		expect(seen.board?.pointers.map((pointer) => [pointer.tone, pointer.correctAt])).toEqual([
			['correct', null],
			['correct', null]
		]);
		expect(seen.verdict).toMatchObject({ correct: true, correctText: '`l` at 1, `r` at 3' });
		const done = advance(checked);
		expect(done.completed).toEqual([{ deckId: 'drag-sample', questionId: 'move-ends', pickedId: 'l=1,r=3', correct: true }]);
		expect(isFinished(done)).toBe(true);
	});

	it('marks only the wrong pointer, explains it in place, and reveals where it belongs', () => {
		const checked = check(select(start(dragLesson()), 'l=2,r=3'));
		const seen = view(checked)!;
		expect(seen.board?.pointers.map((pointer) => [pointer.tone, pointer.correctAt, pointer.note])).toEqual([
			['wrong', 1, 'One step is one cell.'],
			['correct', null, 'r stays.']
		]);
		expect(seen.verdict).toMatchObject({ correct: false, explanation: '`l`: One step is one cell.' });
		const done = advance(checked);
		expect(done.stage).toBe('question');
		expect(done.completed[0]).toMatchObject({ pickedId: 'l=2,r=3', correct: false });
		expect(summarize(done).missed).toEqual([
			{
				questionId: 'move-ends',
				prompt: 'Where do `l` and `r` sit after one step?',
				pickedText: '`l` at 2, `r` at 3',
				correctText: '`l` at 1, `r` at 3',
				followUpCorrect: null
			}
		]);
	});
});

function traceQuestion(): StepTraceQuestion {
	return {
		format: 'step-trace',
		id: 'trace-sum',
		prompt: 'Trace the scan.',
		code: 'total = nums[l] + nums[r]\nif total < target:\n    l += 1',
		sequence: { kind: 'array', name: 'nums', cells: ['1', '4', '6', '8'] },
		start: [
			{ name: 'l', at: 0 },
			{ name: 'r', at: 3 }
		],
		steps: [
			{
				line: 3,
				ask: 'Where does `l` sit after this pass?',
				pointer: 'l',
				correct: 1,
				explanation: 'The sum is too small, so l moves.',
				misses: [{ index: 3, explanation: 'l never jumps to r.' }],
				elsewhere: 'l moves exactly one cell.'
			},
			{
				line: 1,
				ask: 'What is `total` on the next pass?',
				options: [
					{ id: 'ten', text: '10', explanation: '4 + 8 is 12, not 10.' },
					{ id: 'twelve', text: '12', explanation: '4 + 8 is 12.' }
				],
				correct: 'twelve'
			}
		]
	};
}

function traceLesson(): Deck {
	return { id: 'trace-sample', title: 'Trace', description: 'Trace a scan.', heading: 'Trace it', questions: [traceQuestion()] };
}

describe('step-trace lessons', () => {
	it('opens on step 1 with the pointers at their start cells and the step\'s line highlighted', () => {
		const first = view(start(traceLesson()))!;
		expect(first.format).toBe('step-trace');
		expect(first.heading).toBe('Where does `l` sit after this pass?');
		expect(first.trace).toEqual({ step: 1, total: 2, line: 3, kind: 'cell' });
		expect(first.board?.cells.map((cell) => cell.markers)).toEqual([['l'], [], [], ['r']]);
		expect(first.options).toEqual([]);
		expect(first.canCheck).toBe(false);
	});

	it('checks a step as it is picked, then moves the pointer to the true cell on the next step', () => {
		let state = select(start(traceLesson()), '3', true);
		const wrong = view(state)!;
		expect(wrong.board?.cells.map((cell) => [cell.tone, cell.reveal])).toEqual([
			['idle', false],
			['correct', true],
			['idle', false],
			['wrong', false]
		]);
		expect(wrong.board?.note).toBe('l never jumps to r.');
		expect(wrong.verdict).toMatchObject({ correct: false, correctText: 'index 1, `4`' });

		state = advance(state);
		expect(state.completed).toEqual([]);
		const next = view(state)!;
		expect(next.trace).toEqual({ step: 2, total: 2, line: 1, kind: 'choice' });
		expect(next.board?.cells.map((cell) => cell.markers)).toEqual([[], ['l'], [], ['r']]);
		expect(next.options.map((option) => option.id).sort()).toEqual(['ten', 'twelve']);
		expect(next.verdict).toBeNull();
		expect(progress(state)).toBe(0.5);
	});

	it('records one attempt after the last step, right only when every step was', () => {
		const allRight = advance(select(advance(select(start(traceLesson()), '1', true)), 'twelve', true));
		expect(allRight.completed).toEqual([{ deckId: 'trace-sample', questionId: 'trace-sum', pickedId: '1,twelve', correct: true }]);
		expect(isFinished(allRight)).toBe(true);

		const oneWrong = advance(select(advance(select(start(traceLesson()), '1', true)), 'ten', true));
		expect(oneWrong.completed[0]).toMatchObject({ pickedId: '1,ten', correct: false });
		expect(summarize(oneWrong).missed).toEqual([
			{
				questionId: 'trace-sum',
				prompt: 'Trace the scan.',
				pickedText: 'Step 2: 10',
				correctText: 'Step 2: 12',
				followUpCorrect: null
			}
		]);
	});

	it('explains a wrong value in the verdict, and ignores a pick the step does not offer', () => {
		const second = advance(select(start(traceLesson()), '1', true));
		expect(select(second, '1', true)).toBe(second);
		const wrong = view(select(second, 'ten', true))!;
		expect(wrong.verdict).toMatchObject({ correct: false, correctText: '12', explanation: '4 + 8 is 12, not 10.' });
		expect(isPristine(second)).toBe(false);
	});
});
