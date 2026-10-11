import type { Deck, FollowUp, Question } from '$lib/content/schema';
import { shuffled, type Rng } from './shuffle';

/**
 * The lesson loop as a pure state machine.
 *
 *   question --select--> question --check--> feedback
 *     feedback (right)  --advance--> next question
 *     feedback (wrong)  --advance--> follow-up (keyed by the wrong option picked)
 *       follow-up --select/check--> feedback --advance--> next question
 *
 * A wrong answer can only leave the question stage through its follow-up,
 * which is the rule this app exists to enforce. Every transition returns a
 * new state, and invalid transitions return the state unchanged.
 */

export type Stage = 'question' | 'followUp';

export interface PlannedQuestion {
	/** The deck the question belongs to. A review lesson mixes decks. */
	deckId: string;
	/** The deck's default heading, used when the question has none. */
	heading?: string;
	question: Question;
	/** Option ids in the order the learner sees them. */
	optionOrder: string[];
	/** Follow-up option ids in display order, keyed by the wrong option that triggers each. */
	followUpOrders: Record<string, string[]>;
}

export interface Completed {
	deckId: string;
	questionId: string;
	/** The option picked on the main question. */
	pickedId: string;
	correct: boolean;
	/** Present only when the main answer was wrong. */
	followUp?: { pickedId: string; correct: boolean };
}

export interface LessonState {
	readonly deckId: string;
	readonly plan: readonly PlannedQuestion[];
	readonly cursor: number;
	readonly stage: Stage;
	readonly selected: string | null;
	readonly checked: boolean;
	/** The wrong option picked on the main question, once the learner is in its follow-up. */
	readonly mainPick: string | null;
	readonly completed: readonly Completed[];
}

/** A question and where it came from, so lessons can mix decks. */
export interface LessonEntry {
	deckId: string;
	/** The deck's default heading. */
	heading?: string;
	question: Question;
}

function plan(id: string, entries: readonly LessonEntry[], rng: Rng): LessonState {
	const planned = shuffled(entries, rng).map(({ deckId, heading, question }) => ({
		deckId,
		heading,
		question,
		optionOrder: shuffled(
			question.options.map((option) => option.id),
			rng
		),
		followUpOrders: Object.fromEntries(
			Object.entries(question.followUps).map(([optionId, followUp]) => [
				optionId,
				shuffled(
					followUp.options.map((option) => option.id),
					rng
				)
			])
		)
	}));
	return {
		deckId: id,
		plan: planned,
		cursor: 0,
		stage: 'question',
		selected: null,
		checked: false,
		mainPick: null,
		completed: []
	};
}

export function createLesson(deck: Deck, rng: Rng = Math.random): LessonState {
	return plan(
		deck.id,
		deck.questions.map((question) => ({ deckId: deck.id, heading: deck.heading, question })),
		rng
	);
}

/** One lesson over questions from any decks, such as today's review. */
export function createReviewLesson(entries: readonly LessonEntry[], rng: Rng = Math.random): LessonState {
	return plan('review', entries, rng);
}

export function isFinished(state: LessonState): boolean {
	return state.cursor >= state.plan.length;
}

/** True before the learner has answered anything. Used to skip the quit confirmation. */
export function isPristine(state: LessonState): boolean {
	return state.cursor === 0 && state.stage === 'question' && state.selected === null;
}

function currentPlanned(state: LessonState): PlannedQuestion | null {
	return state.plan[state.cursor] ?? null;
}

function currentFollowUp(state: LessonState): FollowUp | null {
	const planned = currentPlanned(state);
	if (!planned || state.stage !== 'followUp' || state.mainPick === null) return null;
	return planned.question.followUps[state.mainPick] ?? null;
}

function activeOptionIds(state: LessonState): string[] {
	const planned = currentPlanned(state);
	if (!planned) return [];
	if (state.stage === 'question') return planned.optionOrder;
	return state.mainPick === null ? [] : (planned.followUpOrders[state.mainPick] ?? []);
}

export function select(state: LessonState, optionId: string): LessonState {
	if (isFinished(state) || state.checked) return state;
	if (!activeOptionIds(state).includes(optionId)) return state;
	return { ...state, selected: optionId };
}

export function check(state: LessonState): LessonState {
	if (isFinished(state) || state.checked || state.selected === null) return state;
	return { ...state, checked: true };
}

function finishQuestion(state: LessonState, done: Completed): LessonState {
	return {
		...state,
		completed: [...state.completed, done],
		cursor: state.cursor + 1,
		stage: 'question',
		selected: null,
		checked: false,
		mainPick: null
	};
}

export function advance(state: LessonState): LessonState {
	const planned = currentPlanned(state);
	if (!planned || !state.checked || state.selected === null) return state;
	const { question } = planned;

	if (state.stage === 'question') {
		if (state.selected === question.correct) {
			return finishQuestion(state, {
				deckId: planned.deckId,
				questionId: question.id,
				pickedId: state.selected,
				correct: true
			});
		}
		return { ...state, stage: 'followUp', mainPick: state.selected, selected: null, checked: false };
	}

	const followUp = currentFollowUp(state);
	if (!followUp || state.mainPick === null) return state;
	return finishQuestion(state, {
		deckId: planned.deckId,
		questionId: question.id,
		pickedId: state.mainPick,
		correct: false,
		followUp: { pickedId: state.selected, correct: state.selected === followUp.correct }
	});
}

/** Fraction of the lesson completed. Reaching a follow-up counts as half a question. */
export function progress(state: LessonState): number {
	if (state.plan.length === 0) return 1;
	const half = state.stage === 'followUp' && !isFinished(state) ? 0.5 : 0;
	return Math.min(1, (state.cursor + half) / state.plan.length);
}

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong';

export interface OptionView {
	id: string;
	text: string;
	state: OptionState;
}

export interface Verdict {
	correct: boolean;
	correctText: string;
	/** Shown inline in the sheet. Empty on a wrong main answer, where it hides behind "See why again". */
	explanation: string;
}

export interface SeeWhy {
	pickedText: string;
	pickedExplanation: string;
	correctText: string;
	correctExplanation: string;
}

export interface LessonView {
	stage: Stage;
	/** 1-based position of the current question. */
	position: number;
	total: number;
	heading: string | undefined;
	/** The original problem. Pinned above the follow-up too. */
	prompt: string;
	/** The follow-up question, when in the follow-up stage. */
	followUpPrompt: string | null;
	options: OptionView[];
	canCheck: boolean;
	verdict: Verdict | null;
	/** Available only after a wrong main answer. */
	seeWhy: SeeWhy | null;
}

function optionStates(
	ids: string[],
	selected: string | null,
	checked: boolean,
	correctId: string
): Record<string, OptionState> {
	const states: Record<string, OptionState> = {};
	for (const id of ids) {
		if (!checked) states[id] = id === selected ? 'selected' : 'idle';
		else if (id === correctId) states[id] = 'correct';
		else if (id === selected) states[id] = 'wrong';
		else states[id] = 'idle';
	}
	return states;
}

/** Everything the lesson screen renders, derived from the state. Null once finished. */
export function view(state: LessonState, deckHeading?: string): LessonView | null {
	const planned = currentPlanned(state);
	if (!planned) return null;
	const { question } = planned;
	const base = {
		stage: state.stage,
		position: state.cursor + 1,
		total: state.plan.length,
		heading: question.heading ?? planned.heading ?? deckHeading,
		prompt: question.prompt,
		canCheck: !state.checked && state.selected !== null
	};

	if (state.stage === 'question') {
		const states = optionStates(planned.optionOrder, state.selected, state.checked, question.correct);
		const byId = new Map(question.options.map((option) => [option.id, option]));
		const options = planned.optionOrder.map((id) => ({
			id,
			text: byId.get(id)!.text,
			state: states[id]
		}));
		const correctOption = byId.get(question.correct)!;
		let verdict: Verdict | null = null;
		let seeWhy: SeeWhy | null = null;
		if (state.checked && state.selected !== null) {
			const correct = state.selected === question.correct;
			verdict = {
				correct,
				correctText: correctOption.text,
				explanation: correct ? correctOption.explanation : ''
			};
			if (!correct) {
				const picked = byId.get(state.selected)!;
				seeWhy = {
					pickedText: picked.text,
					pickedExplanation: picked.explanation,
					correctText: correctOption.text,
					correctExplanation: correctOption.explanation
				};
			}
		}
		return { ...base, followUpPrompt: null, options, verdict, seeWhy };
	}

	const followUp = currentFollowUp(state)!;
	const order = planned.followUpOrders[state.mainPick!];
	const states = optionStates(order, state.selected, state.checked, followUp.correct);
	const byId = new Map(followUp.options.map((option) => [option.id, option]));
	const options = order.map((id) => ({ id, text: byId.get(id)!.text, state: states[id] }));
	const verdict: Verdict | null =
		state.checked && state.selected !== null
			? {
					correct: state.selected === followUp.correct,
					correctText: byId.get(followUp.correct)!.text,
					explanation: followUp.explanation
				}
			: null;
	return { ...base, followUpPrompt: followUp.prompt, options, verdict, seeWhy: null };
}

export interface MissedQuestion {
	questionId: string;
	prompt: string;
	pickedText: string;
	correctText: string;
	followUpCorrect: boolean;
}

export interface Summary {
	total: number;
	correctFirstTry: number;
	followUpsAttempted: number;
	followUpsCorrect: number;
	missed: MissedQuestion[];
}

export function summarize(state: LessonState): Summary {
	const byQuestion = new Map(
		state.plan.map((planned) => [`${planned.deckId}/${planned.question.id}`, planned.question])
	);
	const missed: MissedQuestion[] = [];
	let correctFirstTry = 0;
	let followUpsCorrect = 0;
	for (const done of state.completed) {
		if (done.correct) {
			correctFirstTry += 1;
			continue;
		}
		const question = byQuestion.get(`${done.deckId}/${done.questionId}`)!;
		const followUpCorrect = done.followUp?.correct ?? false;
		if (followUpCorrect) followUpsCorrect += 1;
		missed.push({
			questionId: question.id,
			prompt: question.prompt,
			pickedText: question.options.find((option) => option.id === done.pickedId)!.text,
			correctText: question.options.find((option) => option.id === question.correct)!.text,
			followUpCorrect
		});
	}
	return {
		total: state.completed.length,
		correctFirstTry,
		followUpsAttempted: missed.length,
		followUpsCorrect,
		missed
	};
}
