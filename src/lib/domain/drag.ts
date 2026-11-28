import type { DragPointersQuestion } from '$lib/content/schema';

/**
 * Checking a drag-pointers answer.
 *
 * The picked id is the whole placement, one `name=index` pair per movable
 * pointer in the order the question lists them: `left=2,right=5`. That is what
 * an attempt stores in `pickedId`. Option ids are kebab-case and tap indexes
 * are bare digits, so a placement never looks like either.
 */

/** Where each movable pointer sits, keyed by name. */
export type Placement = Readonly<Record<string, number>>;

function cellTotal(question: DragPointersQuestion): number {
	return question.sequence.cells.length + (question.sequence.pastEnd ? 1 : 0);
}

export function startPlacement(question: DragPointersQuestion): Placement {
	return Object.fromEntries(question.pointers.map((pointer) => [pointer.name, pointer.start]));
}

export function correctPlacement(question: DragPointersQuestion): Placement {
	return Object.fromEntries(question.pointers.map((pointer) => [pointer.name, pointer.correct]));
}

export function placementPickId(question: DragPointersQuestion, placement: Placement): string {
	return question.pointers.map((pointer) => `${pointer.name}=${placement[pointer.name]}`).join(',');
}

/** Null unless `pickedId` names every movable pointer, once, in order, on a real cell. */
export function parsePlacement(question: DragPointersQuestion, pickedId: string): Placement | null {
	const parts = pickedId.split(',');
	if (parts.length !== question.pointers.length) return null;
	const total = cellTotal(question);
	const placement: Record<string, number> = {};
	for (const [position, part] of parts.entries()) {
		const match = /^([A-Za-z][A-Za-z0-9]*)=(0|[1-9]\d*)$/.exec(part);
		if (!match || match[1] !== question.pointers[position]!.name) return null;
		const index = Number(match[2]);
		if (index >= total) return null;
		placement[match[1]] = index;
	}
	return placement;
}

/** The pick that results from moving one pointer. `current` is the pick so far, or null for the start. */
export function movePointer(question: DragPointersQuestion, current: string | null, name: string, at: number): string | null {
	if (!question.pointers.some((pointer) => pointer.name === name) || at < 0 || at >= cellTotal(question)) return null;
	const placement = (current === null ? null : parsePlacement(question, current)) ?? startPlacement(question);
	return placementPickId(question, { ...placement, [name]: at });
}

export interface PointerResult {
	name: string;
	at: number;
	correct: boolean;
	/** The pointer's own explanation, or the explanation written for the cell it was left on. */
	explanation: string;
}

export interface PlacementResult {
	correct: boolean;
	pointers: PointerResult[];
	/** Markdown: one paragraph per pointer that is wrong, or per pointer when every one is right. */
	explanation: string;
}

/** Null when `pickedId` is not a placement of this question's pointers. */
export function checkPlacement(question: DragPointersQuestion, pickedId: string): PlacementResult | null {
	const placement = parsePlacement(question, pickedId);
	if (!placement) return null;
	const pointers = question.pointers.map((pointer): PointerResult => {
		const at = placement[pointer.name]!;
		if (at === pointer.correct) return { name: pointer.name, at, correct: true, explanation: pointer.explanation };
		const miss = pointer.misses?.find((item) => item.index === at);
		return { name: pointer.name, at, correct: false, explanation: miss?.explanation ?? pointer.elsewhere };
	});
	const correct = pointers.every((pointer) => pointer.correct);
	const shown = correct ? pointers : pointers.filter((pointer) => !pointer.correct);
	return {
		correct,
		pointers,
		explanation: shown.map((pointer) => `\`${pointer.name}\`: ${pointer.explanation}`).join('\n\n')
	};
}

/** A short label for summaries and the feedback sheet. Names are inline code. */
export function placementLabel(question: DragPointersQuestion, placement: Placement): string {
	return question.pointers.map((pointer) => `\`${pointer.name}\` at ${placement[pointer.name]}`).join(', ');
}
