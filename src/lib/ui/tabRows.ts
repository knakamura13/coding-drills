/**
 * Rows for pointer tabs under a strip of cells (Question formats, Drag A), so no two tabs overlap:
 * two pointers on one cell stack, and so do long names on neighboring cells.
 */

export interface Span {
	/** Center of the tab, in px. */
	center: number;
	width: number;
}

/**
 * The row of each span, in input order. Spans are taken left to right; each goes in the first row
 * where it clears every span already there by `gap`, so the rows stay as few as possible.
 */
export function stackRows(spans: readonly Span[], gap = 4): number[] {
	const order = spans.map((span, index) => ({ ...span, index })).sort((a, b) => a.center - b.center || a.index - b.index);
	const rows: { left: number; right: number }[][] = [];
	const result = new Array<number>(spans.length).fill(0);
	for (const span of order) {
		const left = span.center - span.width / 2;
		const right = span.center + span.width / 2;
		let row = rows.findIndex((taken) => taken.every((other) => right + gap <= other.left || left >= other.right + gap));
		if (row === -1) {
			row = rows.length;
			rows.push([]);
		}
		rows[row]!.push({ left, right });
		result[span.index] = row;
	}
	return result;
}
