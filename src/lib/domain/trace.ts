import { isCellStep, type StepTraceQuestion, type TraceStep } from '$lib/content/schema';
import { isCellIndexId } from './tap';

/**
 * Checking a step-through trace.
 *
 * A trace is a run of predictions. Each step is answered on its own: a cell
 * step by the tapped cell's index (`"3"`), a choice step by the option id. The
 * attempt stores every pick joined by commas (`"1,two-sum,3"`), one per step.
 * The question is right only when every step was.
 */

function cellTotal(question: StepTraceQuestion): number {
	return question.sequence.cells.length + (question.sequence.pastEnd ? 1 : 0);
}

/**
 * Where each pointer sits when step `step` opens. A step that has been revealed
 * puts its pointer on the true cell, whatever the learner predicted, so the
 * trace always carries on from the truth.
 */
export function positionsBefore(question: StepTraceQuestion, step: number): Record<string, number> {
	const at: Record<string, number> = Object.fromEntries(question.start.map((marker) => [marker.name, marker.at]));
	for (const done of question.steps.slice(0, step)) {
		if (isCellStep(done)) at[done.pointer] = done.correct;
		for (const moved of done.also ?? []) at[moved.name] = moved.at;
	}
	return at;
}

/** The cell ids a cell step offers, or the option ids a choice step offers, in authored order. */
export function stepPickIds(question: StepTraceQuestion, step: number): string[] {
	const current = question.steps[step];
	if (!current) return [];
	if (isCellStep(current)) return Array.from({ length: cellTotal(question) }, (_, index) => String(index));
	return current.options.map((option) => option.id);
}

/** A readable name for one pick, for the feedback sheet and the summary. Inline code. */
export function stepPickLabel(question: StepTraceQuestion, step: number, pick: string): string {
	const current = question.steps[step];
	if (!current) return pick;
	if (isCellStep(current)) {
		const index = Number(pick);
		if (index === question.sequence.cells.length && question.sequence.pastEnd) return `index ${index}, past the end`;
		const value = question.sequence.cells[index];
		return value === undefined || value === '' ? `index ${index}` : `index ${index}, \`${value}\``;
	}
	return current.options.find((option) => option.id === pick)?.text ?? pick;
}

export function stepCorrectPick(step: TraceStep): string {
	return isCellStep(step) ? String(step.correct) : step.correct;
}

export interface StepResult {
	correct: boolean;
	/** The explanation written for this prediction. */
	explanation: string;
}

/** Null when `pick` is not an answer this step offers. */
export function checkStep(question: StepTraceQuestion, step: number, pick: string): StepResult | null {
	const current = question.steps[step];
	if (!current) return null;
	if (isCellStep(current)) {
		if (!isCellIndexId(pick) || Number(pick) >= cellTotal(question)) return null;
		const index = Number(pick);
		if (index === current.correct) return { correct: true, explanation: current.explanation };
		const miss = current.misses?.find((item) => item.index === index);
		return { correct: false, explanation: miss?.explanation ?? current.elsewhere };
	}
	const option = current.options.find((item) => item.id === pick);
	if (!option) return null;
	return { correct: pick === current.correct, explanation: option.explanation };
}

/** Whether each step's recorded pick was right, or null when `pickedId` does not fit this trace. */
export function parsePicks(question: StepTraceQuestion, pickedId: string): { picks: string[]; right: boolean[] } | null {
	const picks = pickedId.split(',');
	if (picks.length !== question.steps.length) return null;
	const right: boolean[] = [];
	for (const [step, pick] of picks.entries()) {
		const result = checkStep(question, step, pick);
		if (!result) return null;
		right.push(result.correct);
	}
	return { picks, right };
}
