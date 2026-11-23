/**
 * Where the summary's tree piece draws, in a 340 x 320 box (the Lesson Motion Lab's numbers).
 * `t` runs from 0, the rising curve (summary screen 8), to 1, the flat left-to-right branch under
 * the open misses drawer (screen 9). The motion pass animates `t`; today it is 0 or 1.
 */

export const TREE_WIDTH = 340;
export const TREE_HEIGHT = 320;
/** Height of the flat layout with its labels hanging below, for the open drawer's top edge. */
export const FLAT_HEIGHT = 120;

type Slot = 'b' | 'e' | 'l';
const CURVE: Record<Slot, [number, number]> = { b: [64, 250], e: [152, 160], l: [248, 76] };
const FLAT: Record<Slot, [number, number]> = { b: [40, 40], e: [170, 40], l: [292, 40] };
const LEAF_R = { curve: 34, flat: 28 };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const at = (slot: Slot, t: number): [number, number] => [lerp(CURVE[slot][0], FLAT[slot][0], t), lerp(CURVE[slot][1], FLAT[slot][1], t)];

export interface Placed {
	x: number;
	y: number;
	scale: number;
	/** Label anchor in box units, and which side of it the label hangs. */
	label: { x: number; y: number; align: 'start' | 'end' | 'center'; below: boolean };
}

export interface TrailLayout {
	/** One per earlier node, oldest first. */
	earlier: Placed[];
	leaf: Placed & { r: number };
	edges: string[];
	trunk: string | null;
}

/** Earlier nodes take the slots that end next to the leaf: two use b and e, one uses e. */
export function trailLayout(earlierCount: number, t: number): TrailLayout {
	const slots: Slot[] = earlierCount >= 2 ? ['b', 'e'] : earlierCount === 1 ? ['e'] : [];
	const flat = t > 0.5;
	const r = lerp(LEAF_R.curve, LEAF_R.flat, t);
	const below = LEAF_R.flat + 6;
	const [lx, ly] = at('l', t);
	const earlier = slots.map((slot) => {
		const [x, y] = at(slot, t);
		const dx = slot === 'b' ? 28 : 30;
		return {
			x,
			y,
			scale: lerp(1, slot === 'b' ? 0.85 : 0.8, t),
			label: flat ? { x, y: y + below, align: 'center' as const, below: true } : { x: x + dx, y, align: 'start' as const, below: false }
		};
	});
	const points = [...earlier.map((node) => [node.x, node.y] as const), [lx, ly] as const];
	const edges: string[] = [];
	for (let index = 1; index < points.length; index++) {
		const [ax, ay] = points[index - 1]!;
		const [bx, by] = points[index]!;
		// The curve bows up and to the right; flat, the control point sits on the line.
		const last = index === points.length - 1;
		const cx = lerp(ax + (last ? 50 : 20), (ax + bx) / 2, t);
		const cy = lerp(ay - (last ? 20 : 70), (ay + by) / 2, t);
		edges.push(`M${ax} ${ay} Q${cx} ${cy} ${bx} ${by}`);
	}
	const first = points[0]!;
	const trunk = earlier.length > 0 ? `M${first[0] - 60} ${first[1] + lerp(40, 0, t)} L${first[0] - 18} ${first[1]}` : null;
	return {
		earlier,
		leaf: {
			x: lx,
			y: ly,
			r,
			scale: 1,
			label: flat ? { x: lx, y: ly + below, align: 'center', below: true } : { x: lx - 44, y: ly, align: 'end', below: false }
		},
		edges,
		trunk
	};
}

/** One arc per question around the leaf, clockwise from the top, with a 5 degree gap between. */
export function ringArcs(r: number, count: number): string[] {
	if (count === 0) return [];
	const gap = (5 * Math.PI) / 180;
	const step = (2 * Math.PI) / count;
	const point = (angle: number) => `${(r * Math.cos(angle)).toFixed(2)} ${(r * Math.sin(angle)).toFixed(2)}`;
	return Array.from({ length: count }, (_, index) => {
		const from = -Math.PI / 2 + index * step + (count > 1 ? gap / 2 : 0);
		const to = from + step - (count > 1 ? gap : 0.0001);
		const large = to - from > Math.PI ? 1 : 0;
		return `M${point(from)} A${r} ${r} 0 ${large} 1 ${point(to)}`;
	});
}
