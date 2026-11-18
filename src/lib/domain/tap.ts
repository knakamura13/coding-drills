import type { TapCellQuestion } from '$lib/content/schema';

/**
 * Checking a tap-cell answer.
 *
 * The picked id is the cell's index in decimal (`"0"`, `"1"`, …), which is
 * what an attempt stores in `pickedId`. Option ids are kebab-case, so a cell
 * index never looks like one.
 */

/** How many cells can be tapped, counting a past-the-end slot. */
export function cellCount(question: TapCellQuestion): number {
	return question.sequence.cells.length + (question.sequence.pastEnd ? 1 : 0);
}

export function cellPickId(index: number): string {
	return String(index);
}

/** A decimal index with no sign and no leading zero, except for `"0"`. */
export function isCellIndexId(value: string): boolean {
	return /^(0|[1-9]\d*)$/.test(value);
}

export function parseCellIndex(pickedId: string, count: number): number | null {
	if (!isCellIndexId(pickedId)) return null;
	const index = Number(pickedId);
	if (index >= count) return null;
	return index;
}

export interface TapResult {
	correct: boolean;
	index: number;
	/** The correct-cell explanation, or the explanation written for this miss. */
	explanation: string;
}

/** Null when `pickedId` is not one of the question's cells. */
export function checkTap(question: TapCellQuestion, pickedId: string): TapResult | null {
	const index = parseCellIndex(pickedId, cellCount(question));
	if (index === null) return null;
	if (index === question.correct) {
		return { correct: true, index, explanation: question.explanation };
	}
	const miss = question.misses.find((item) => item.index === index);
	if (!miss) return null;
	return { correct: false, index, explanation: miss.explanation };
}

/** A short label for summaries and the feedback sheet. Values are inline code. */
export function cellLabel(question: TapCellQuestion, index: number): string {
	if (index === question.sequence.cells.length && question.sequence.pastEnd) {
		return `index ${index}, past the end`;
	}
	const value = question.sequence.cells[index] ?? '';
	if (value === '') return `index ${index}, empty`;
	return `index ${index}, \`${value}\``;
}
