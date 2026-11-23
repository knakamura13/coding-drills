import {
	isChoiceQuestion,
	isCellStep,
	isDragPointersQuestion,
	isStepTraceQuestion,
	isTapCellQuestion,
	type Deck,
	type DragPointersQuestion,
	type FollowUp,
	type Question,
	type StepTraceQuestion,
	type TapCellQuestion
} from '$lib/content/schema';
import { sequenceModel, type SequenceCell } from './board';
import {
	checkPlacement,
	correctPlacement,
	parsePlacement,
	placementLabel,
	startPlacement,
	type PlacementResult
} from './drag';
import { shuffled, type Rng } from './shuffle';
import type { QuestionRef } from '$lib/storage/types';
import { cellCount, cellLabel, cellPickId, checkTap } from './tap';
import { checkStep, parsePicks, positionsBefore, stepCorrectPick, stepPickIds, stepPickLabel } from './trace';

/**
 * The lesson loop as a pure state machine.
 *
 *   question --select--> question --check--> feedback
 *     With immediate feedback, select checks in the same step.
 *     feedback (right)  --advance--> next question
 *     feedback (wrong)  --advance--> follow-up (keyed by the wrong option picked)
 *       follow-up --select/check--> feedback --advance--> next question
 *
 * A wrong multiple-choice answer can only leave the question stage through its
 * follow-up. A tap-cell or drag-pointers question has no second stage: the
 * explanation written for the cell or the pointer is the feedback, and advance
 * records the attempt either way. A step-trace question is a run of such
 * answers: each step is checked as soon as it is picked, advance moves to the
 * next step, and the attempt is recorded after the last one.
 * Every transition returns a new state, and invalid transitions return the
 * state unchanged.
 */

export type Stage = 'question' | 'followUp';

export interface PlannedQuestion extends LessonEntry {
	/** Option ids in the order the learner sees them. */
	optionOrder: string[];
	/** Follow-up option ids in display order, keyed by the wrong option that triggers each. */
	followUpOrders: Record<string, string[]>;
	/** For a step-trace question: the pick ids each step offers, in display order. Empty otherwise. */
	stepOrders: string[][];
}

export interface Completed extends QuestionRef {
	reviewOf?: QuestionRef;
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
	/** For a step-trace question: the picks already made on its earlier steps. */
	readonly picks: readonly string[];
	readonly completed: readonly Completed[];
}

/** A question and where it came from, so lessons can mix decks. */
export interface LessonEntry {
	deckId: string;
	reviewOf?: QuestionRef;
	/** The deck's default heading. */
	heading?: string;
	question: Question;
}

function plan(id: string, entries: readonly LessonEntry[], rng: Rng): LessonState {
	const planned = shuffled(entries, rng).map(({ question, ...entry }) => ({
		...entry,
		question,
		optionOrder: isTapCellQuestion(question)
			? Array.from({ length: cellCount(question) }, (_, index) => cellPickId(index))
			: isDragPointersQuestion(question) || isStepTraceQuestion(question)
				? []
				: shuffled(
						question.options.map((option) => option.id),
						rng
					),
		stepOrders: isStepTraceQuestion(question)
			? question.steps.map((step, index) =>
					isCellStep(step) ? stepPickIds(question, index) : shuffled(stepPickIds(question, index), rng)
				)
			: [],
		followUpOrders: isChoiceQuestion(question)
			? Object.fromEntries(
					Object.entries(question.followUps).map(([optionId, followUp]) => [
						optionId,
						shuffled(
							followUp.options.map((option) => option.id),
							rng
						)
					])
				)
			: {}
	}));
	return {
		deckId: id,
		plan: planned,
		cursor: 0,
		stage: 'question',
		selected: null,
		checked: false,
		mainPick: null,
		picks: [],
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
	return state.cursor === 0 && state.stage === 'question' && state.selected === null && state.picks.length === 0;
}

function currentPlanned(state: LessonState): PlannedQuestion | null {
	return state.plan[state.cursor] ?? null;
}

function currentFollowUp(state: LessonState): FollowUp | null {
	const planned = currentPlanned(state);
	if (!planned || state.stage !== 'followUp' || state.mainPick === null) return null;
	if (!isChoiceQuestion(planned.question)) return null;
	return planned.question.followUps[state.mainPick] ?? null;
}

function activeOptionIds(state: LessonState): string[] {
	const planned = currentPlanned(state);
	if (!planned) return [];
	if (state.stage === 'question') return planned.optionOrder;
	return state.mainPick === null ? [] : (planned.followUpOrders[state.mainPick] ?? []);
}

/** A drag answer is a whole placement, so it is valid by shape, not by membership in a list. */
function isPickable(state: LessonState, pick: string): boolean {
	const planned = currentPlanned(state);
	const question = planned?.question;
	if (question && isDragPointersQuestion(question)) return parsePlacement(question, pick) !== null;
	if (planned && question && isStepTraceQuestion(question)) return (planned.stepOrders[state.picks.length] ?? []).includes(pick);
	return activeOptionIds(state).includes(pick);
}

/** Records the pick. When `immediate` is set, the pick is checked in the same step. */
export function select(state: LessonState, optionId: string, immediate = false): LessonState {
	if (isFinished(state) || state.checked) return state;
	if (!isPickable(state, optionId)) return state;
	const next = { ...state, selected: optionId };
	return immediate ? check(next) : next;
}

export function check(state: LessonState): LessonState {
	if (isFinished(state) || state.checked || state.selected === null) return state;
	return { ...state, checked: true };
}

function finishQuestion(state: LessonState, done: Completed): LessonState {
	const reviewOf = currentPlanned(state)?.reviewOf;
	return {
		...state,
		completed: [...state.completed, reviewOf ? { ...done, reviewOf } : done],
		cursor: state.cursor + 1,
		stage: 'question',
		selected: null,
		checked: false,
		mainPick: null,
		picks: []
	};
}

export function advance(state: LessonState): LessonState {
	const planned = currentPlanned(state);
	if (!planned || !state.checked || state.selected === null) return state;
	const { question } = planned;

	if (state.stage === 'question') {
		if (isStepTraceQuestion(question)) {
			const picks = [...state.picks, state.selected];
			if (picks.length < question.steps.length) return { ...state, picks, selected: null, checked: false };
			const run = parsePicks(question, picks.join(','));
			if (!run) return state;
			return finishQuestion(state, {
				deckId: planned.deckId,
				questionId: question.id,
				pickedId: picks.join(','),
				correct: run.right.every(Boolean)
			});
		}
		if (isTapCellQuestion(question) || isDragPointersQuestion(question)) {
			const result = isTapCellQuestion(question)
				? checkTap(question, state.selected)
				: checkPlacement(question, state.selected);
			if (!result) return state;
			return finishQuestion(state, {
				deckId: planned.deckId,
				questionId: question.id,
				pickedId: state.selected,
				correct: result.correct
			});
		}
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
	const question = currentPlanned(state)?.question;
	const within =
		question && isStepTraceQuestion(question)
			? state.picks.length / question.steps.length
			: state.stage === 'followUp' && !isFinished(state)
				? 0.5
				: 0;
	return Math.min(1, (state.cursor + within) / state.plan.length);
}

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong';

/** One cell of the sequence board, plus how the current answer has marked it. */
export interface BoardCellView extends SequenceCell {
	tone: OptionState;
	/** The right cell after a wrong tap. The renderer fades it in when motion is allowed. */
	reveal: boolean;
}

export interface BoardView {
	kind: 'sequence';
	presentation: 'array' | 'string';
	name?: string;
	cells: BoardCellView[];
	/** Explanation of the tapped cell, once the answer is checked. */
	note: string | null;
	/** Pointers the learner can move. Empty when the cells themselves are the answer. */
	pointers: PointerView[];
}

/** A pointer the learner moves. Its tone and note appear once the answer is checked. */
export interface PointerView {
	name: string;
	/** Where it sits now: its start until the learner moves it. */
	at: number;
	tone: OptionState;
	/** The cell it belongs on, set only for a pointer that was left on a wrong cell. */
	correctAt: number | null;
	/** Why this pointer is right or wrong, once the answer is checked. */
	note: string | null;
}

export interface OptionView {
	id: string;
	text: string;
	state: OptionState;
}

export interface Verdict {
	correct: boolean;
	correctText: string;
	/** Shown inline on a correct answer and on follow-up feedback. Empty on a wrong main answer, where Why? opens seeWhy. */
	explanation: string;
}

export interface SeeWhy {
	pickedText: string;
	pickedExplanation: string;
	correctText: string;
	correctExplanation: string;
}

/** Where the learner is in a step-through trace. */
export interface TraceView {
	/** 1-based step. */
	step: number;
	total: number;
	/** 1-based line of the code that runs in this step, to highlight. */
	line: number | null;
	/** `cell` steps are answered by tapping the board, `choice` steps by picking a value. */
	kind: 'cell' | 'choice';
}

export interface LessonView {
	stage: Stage;
	format: 'choice' | 'tap-cell' | 'drag-pointers' | 'step-trace';
	/** 1-based position of the current question. */
	position: number;
	total: number;
	heading: string | undefined;
	/** The original problem. Pinned above the follow-up too. */
	prompt: string;
	/** Markdown. A solved example the learner can open. Null when the question has none. */
	workedExample: string | null;
	/** The snippet beside a tap-cell or drag-pointers sequence. Null for multiple choice. */
	code: string | null;
	/** The sequence to tap or to move pointers along. Null for multiple choice. */
	board: BoardView | null;
	/** The follow-up question, when in the follow-up stage. */
	followUpPrompt: string | null;
	options: OptionView[];
	canCheck: boolean;
	/** Set only for a step-trace question. */
	trace: TraceView | null;
	verdict: Verdict | null;
	/** Available only after a wrong multiple-choice answer. */
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
		workedExample: question.workedExample ?? null,
		canCheck: !state.checked && state.selected !== null,
		trace: null as TraceView | null
	};

	if (isTapCellQuestion(question)) {
		const result = state.checked && state.selected !== null ? checkTap(question, state.selected) : null;
		return {
			...base,
			format: 'tap-cell',
			code: question.code,
			board: boardView(question, state.selected, state.checked),
			followUpPrompt: null,
			options: [],
			verdict: result
				? {
						correct: result.correct,
						correctText: cellLabel(question, question.correct),
						explanation: result.explanation
					}
				: null,
			seeWhy: null
		};
	}

	if (isStepTraceQuestion(question)) return traceView(state, planned.stepOrders, question, base);

	if (isDragPointersQuestion(question)) {
		const result = state.checked && state.selected !== null ? checkPlacement(question, state.selected) : null;
		return {
			...base,
			format: 'drag-pointers',
			code: question.code,
			board: dragBoardView(question, state.selected, result),
			followUpPrompt: null,
			options: [],
			verdict: result
				? {
						correct: result.correct,
						correctText: placementLabel(question, correctPlacement(question)),
						explanation: result.explanation
					}
				: null,
			seeWhy: null
		};
	}

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
		return { ...base, format: 'choice', code: null, board: null, followUpPrompt: null, options, verdict, seeWhy };
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
	return { ...base, format: 'choice', code: null, board: null, followUpPrompt: followUp.prompt, options, verdict, seeWhy: null };
}

function boardView(question: TapCellQuestion, selected: string | null, checked: boolean): BoardView {
	const model = sequenceModel({
		presentation: question.sequence.kind,
		name: question.sequence.name,
		values: question.sequence.cells,
		pastEnd: question.sequence.pastEnd,
		markers: question.markers
	});
	const result = checked && selected !== null ? checkTap(question, selected) : null;
	return {
		kind: 'sequence',
		presentation: model.presentation,
		name: model.name,
		note: result?.explanation ?? null,
		pointers: [],
		cells: model.cells.map((cell) => {
			let tone: OptionState = 'idle';
			let reveal = false;
			if (!checked) tone = cell.id === selected ? 'selected' : 'idle';
			else if (result?.correct) tone = cell.id === selected ? 'correct' : 'idle';
			else if (result && cell.id === selected) tone = 'wrong';
			else if (result && cell.index === question.correct) {
				tone = 'correct';
				reveal = true;
			}
			return { ...cell, tone, reveal };
		})
	};
}

/** One step of a trace: the board as the step opens, then the learner's prediction once it is picked. */
function traceView(
	state: LessonState,
	stepOrders: readonly (readonly string[])[],
	question: StepTraceQuestion,
	base: Omit<LessonView, 'format' | 'code' | 'board' | 'followUpPrompt' | 'options' | 'verdict' | 'seeWhy'>
): LessonView {
	const index = Math.min(state.picks.length, question.steps.length - 1);
	const step = question.steps[index]!;
	const onCells = isCellStep(step);
	const picked = state.selected;
	const result = state.checked && picked !== null ? checkStep(question, index, picked) : null;
	const positions = positionsBefore(question, index);
	const model = sequenceModel({
		presentation: question.sequence.kind,
		name: question.sequence.name,
		values: question.sequence.cells,
		pastEnd: question.sequence.pastEnd,
		markers: Object.entries(positions).map(([name, at]) => ({ name, at }))
	});
	const correctPick = stepCorrectPick(step);
	const board: BoardView = {
		kind: 'sequence',
		presentation: model.presentation,
		name: model.name,
		note: onCells && result ? result.explanation : null,
		pointers: [],
		cells: model.cells.map((cell) => {
			let tone: OptionState = 'idle';
			let reveal = false;
			if (!onCells || !result) tone = 'idle';
			else if (result.correct) tone = cell.id === picked ? 'correct' : 'idle';
			else if (cell.id === picked) tone = 'wrong';
			else if (cell.id === correctPick) {
				tone = 'correct';
				reveal = true;
			}
			return { ...cell, tone, reveal };
		})
	};
	let options: OptionView[] = [];
	if (!onCells) {
		const states = optionStates([...stepOrders[index]!], picked, state.checked, step.correct);
		options = stepOrders[index]!.map((id) => ({
			id,
			text: step.options.find((option) => option.id === id)!.text,
			state: states[id]
		}));
	}
	return {
		...base,
		heading: step.ask,
		format: 'step-trace',
		code: question.code,
		board,
		followUpPrompt: null,
		options,
		canCheck: false,
		trace: { step: index + 1, total: question.steps.length, line: step.line ?? null, kind: onCells ? 'cell' : 'choice' },
		verdict: result
			? {
					correct: result.correct,
					correctText: stepPickLabel(question, index, correctPick),
					explanation: result.explanation
				}
			: null,
		seeWhy: null
	};
}

/** The board for a drag question: fixed markers on the cells, movable pointers beside them. */
function dragBoardView(question: DragPointersQuestion, selected: string | null, result: PlacementResult | null): BoardView {
	const model = sequenceModel({
		presentation: question.sequence.kind,
		name: question.sequence.name,
		values: question.sequence.cells,
		pastEnd: question.sequence.pastEnd,
		markers: question.markers
	});
	const placement = (selected === null ? null : parsePlacement(question, selected)) ?? startPlacement(question);
	return {
		kind: 'sequence',
		presentation: model.presentation,
		name: model.name,
		note: null,
		cells: model.cells.map((cell) => ({ ...cell, tone: 'idle', reveal: false })),
		pointers: question.pointers.map((pointer) => {
			const judged = result?.pointers.find((item) => item.name === pointer.name);
			return {
				name: pointer.name,
				at: placement[pointer.name]!,
				tone: !judged ? 'idle' : judged.correct ? 'correct' : 'wrong',
				correctAt: judged && !judged.correct ? pointer.correct : null,
				note: judged?.explanation ?? null
			};
		})
	};
}

export interface MissedQuestion {
	questionId: string;
	prompt: string;
	pickedText: string;
	correctText: string;
	/**
	 * Whether the follow-up was answered correctly.
	 * Null when the question has no follow-up, such as a wrong tap.
	 */
	followUpCorrect: boolean | null;
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
	let followUpsAttempted = 0;
	let followUpsCorrect = 0;
	for (const done of state.completed) {
		if (done.correct) {
			correctFirstTry += 1;
			continue;
		}
		const question = byQuestion.get(`${done.deckId}/${done.questionId}`)!;
		if (isStepTraceQuestion(question)) {
			const run = parsePicks(question, done.pickedId);
			const step = Math.max(0, run ? run.right.indexOf(false) : 0);
			missed.push({
				questionId: question.id,
				prompt: question.prompt,
				pickedText: `Step ${step + 1}: ${stepPickLabel(question, step, run?.picks[step] ?? '')}`,
				correctText: `Step ${step + 1}: ${stepPickLabel(question, step, stepCorrectPick(question.steps[step]!))}`,
				followUpCorrect: null
			});
			continue;
		}
		if (isDragPointersQuestion(question)) {
			const placement = parsePlacement(question, done.pickedId) ?? startPlacement(question);
			missed.push({
				questionId: question.id,
				prompt: question.prompt,
				pickedText: placementLabel(question, placement),
				correctText: placementLabel(question, correctPlacement(question)),
				followUpCorrect: null
			});
			continue;
		}
		if (isTapCellQuestion(question)) {
			missed.push({
				questionId: question.id,
				prompt: question.prompt,
				pickedText: cellLabel(question, Number(done.pickedId)),
				correctText: cellLabel(question, question.correct),
				followUpCorrect: null
			});
			continue;
		}
		if (done.followUp?.correct) followUpsCorrect += 1;
		if (done.followUp) followUpsAttempted += 1;
		missed.push({
			questionId: question.id,
			prompt: question.prompt,
			pickedText: question.options.find((option) => option.id === done.pickedId)!.text,
			correctText: question.options.find((option) => option.id === question.correct)!.text,
			followUpCorrect: done.followUp ? done.followUp.correct : null
		});
	}
	return {
		total: state.completed.length,
		correctFirstTry,
		followUpsAttempted,
		followUpsCorrect,
		missed
	};
}
