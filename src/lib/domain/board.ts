/**
 * The picture of a sequence (an array or a string) shared by interactive questions.
 *
 * Cells keep a stable id and index. Named markers sit on a cell instead of being
 * baked into its value, so a later step-through can move them and a later drag
 * can retarget them. A grid can reuse the same cell and stack one row per line.
 * This module only builds the picture. It does not know which cell is the answer.
 */

export interface PointerMarker {
	name: string;
	/** Index of the cell the marker sits on. */
	at: number;
}

export interface SequenceCell {
	/** Decimal index, also the id stored on an attempt (`"0"`, `"1"`, …). */
	id: string;
	index: number;
	/** Empty when the cell is a past-the-end slot or a blank array entry. */
	value: string;
	pastEnd: boolean;
	/** Marker names parked on this cell, in author order. */
	markers: string[];
}

export interface SequenceModel {
	/** A grid model can sit beside this later without changing the cell shape. */
	kind: 'sequence';
	presentation: 'array' | 'string';
	name?: string;
	cells: SequenceCell[];
}

export interface SequenceInput {
	presentation: 'array' | 'string';
	name?: string;
	values: readonly string[];
	pastEnd?: boolean;
	markers?: readonly PointerMarker[];
}

export function sequenceModel(input: SequenceInput): SequenceModel {
	const byIndex = new Map<number, string[]>();
	for (const marker of input.markers ?? []) {
		const names = byIndex.get(marker.at) ?? [];
		names.push(marker.name);
		byIndex.set(marker.at, names);
	}
	const total = input.values.length + (input.pastEnd ? 1 : 0);
	const cells: SequenceCell[] = [];
	for (let index = 0; index < total; index++) {
		const pastEnd = index >= input.values.length;
		cells.push({
			id: String(index),
			index,
			value: pastEnd ? '' : input.values[index],
			pastEnd,
			markers: byIndex.get(index) ?? []
		});
	}
	return {
		kind: 'sequence',
		presentation: input.presentation,
		...(input.name ? { name: input.name } : {}),
		cells
	};
}
