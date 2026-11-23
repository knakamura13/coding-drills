/**
 * Places graph labels so that none overlaps a node, an edge or another label, and none leaves its
 * box. A label's spots are its forms in order (one line, then wrapped narrower and narrower, then
 * the same a size smaller), each on every side in order. A label with no clear spot
 * gets `null`: the caller hides it rather than let it overlap. Labels keep `inset` from every side
 * of the box (Kyle: text never bumps against the screen edge), while the drawing itself may run
 * past the box. Everything is in px, in the box's coordinates.
 */

export interface Circle {
	x: number;
	y: number;
	r: number;
}

export interface Size {
	w: number;
	h: number;
}

/** `lower` is below, one row down: neighbors in a row can stagger instead of colliding. */
export type Side = 'right' | 'left' | 'below' | 'lower' | 'above';

/** One way to set a label: its measured size, on one line or wrapped to `wrap` px, at full or smaller size. */
export interface LabelForm extends Size {
	wrap: number | null;
	small: boolean;
}

export interface LabelRequest {
	/** The node the label names. */
	node: Circle;
	/** Forms to try, best first. */
	forms: readonly LabelForm[];
	/** Sides to try, best first, for each form. */
	sides: readonly Side[];
	/** Try every form on the first side before the next side, rather than every side per form. */
	sideFirst?: boolean;
}

export interface Placement extends LabelForm {
	x: number;
	y: number;
	side: Side;
}

interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface PlacementOptions {
	/** Clear space between a label and its own node. */
	gap?: number;
	/** Clear space kept between a label and any other node, edge or label. */
	margin?: number;
	/** Clear space kept between a label and the box's edges. */
	inset?: number;
}

function hitsCircle(rect: Rect, circle: Circle): boolean {
	const nearestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
	const nearestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
	return Math.hypot(circle.x - nearestX, circle.y - nearestY) < circle.r;
}

function hitsRect(a: Rect, b: Rect, margin: number): boolean {
	return a.x < b.x + b.w + margin && b.x < a.x + a.w + margin && a.y < b.y + b.h + margin && b.y < a.y + a.h + margin;
}

/** How far a staggered label drops below the row. */
const STAGGER = 24;

function candidate(node: Circle, size: Size, side: Side, gap: number, box: Size, inset: number): Rect {
	const reach = node.r + gap;
	if (side === 'right') return { x: node.x + reach, y: node.y - size.h / 2, ...size };
	if (side === 'left') return { x: node.x - reach - size.w, y: node.y - size.h / 2, ...size };
	// Above or below, the label centers on its node, sliding sideways to stay in the box.
	const x = Math.max(inset, Math.min(box.w - inset - size.w, node.x - size.w / 2));
	if (side === 'below') return { x, y: node.y + reach, ...size };
	if (side === 'lower') return { x, y: node.y + reach + STAGGER, ...size };
	return { x, y: node.y - reach - size.h, ...size };
}

/**
 * `obstacles` are everything a label must clear: every node and points along every edge, each with
 * its radius. The search is joint: it weighs whole arrangements, so one label's best spot never
 * crowds out another label.
 */
export function placeLabels(labels: readonly LabelRequest[], obstacles: readonly Circle[], box: Size, options: PlacementOptions = {}): (Placement | null)[] {
	const gap = options.gap ?? 8;
	const margin = options.margin ?? 6;
	const inset = options.inset ?? 8;
	const inBox = (rect: Rect) => rect.x >= inset && rect.y >= inset && rect.x + rect.w <= box.w - inset && rect.y + rect.h <= box.h - inset;
	const padded = obstacles.map((obstacle) => ({ ...obstacle, r: obstacle.r + margin }));

	// Every spot each label could take on its own, best first.
	const options_ = labels.map((label) => {
		const spots: Placement[] = [];
		const order = label.sideFirst
			? label.sides.flatMap((side) => label.forms.map((form) => [form, side] as const))
			: label.forms.flatMap((form) => label.sides.map((side) => [form, side] as const));
		for (const [form, side] of order) {
			if (form.w <= 0 || form.h <= 0) continue;
			const rect = candidate(label.node, form, side, gap, box, inset);
			// Its own node is cleared by the gap; every other obstacle needs the margin.
			const clear =
				inBox(rect) &&
				!hitsCircle(rect, { ...label.node, r: label.node.r + gap - 0.5 }) &&
				padded.every((obstacle) => (obstacle.x === label.node.x && obstacle.y === label.node.y ? true : !hitsCircle(rect, obstacle)));
			if (clear) spots.push({ ...form, ...rect, side });
		}
		return spots;
	});

	// The best arrangement places the most labels; among those, the lowest cost, where a label's
	// cost is how far down its own list of spots it had to go. So wrapping one label (a step or two
	// down) beats dropping its neighbor to a staggered row (past all its spots under the node).
	let best: (Placement | null)[] = labels.map(() => null);
	let bestCount = -1;
	let bestCost = Infinity;
	const chosen: (Placement | null)[] = [];
	const search = (index: number, count: number, cost: number): void => {
		const reachable = count + (labels.length - index);
		if (reachable < bestCount || (reachable === bestCount && cost >= bestCost)) return;
		if (index === labels.length) {
			best = [...chosen];
			bestCount = count;
			bestCost = cost;
			return;
		}
		options_[index]!.forEach((spot, rank) => {
			if (chosen.some((other) => other && hitsRect(spot, other, margin))) return;
			chosen.push(spot);
			search(index + 1, count + 1, cost + rank);
			chosen.pop();
		});
		chosen.push(null);
		search(index + 1, count, cost);
		chosen.pop();
	};
	search(0, 0, 0);
	return best;
}
