/**
 * Where the summary's tree piece draws (lesson Round 6b, Bleed B: Zoomed in), in a box one phone
 * screen wide. The trunk starts outside the box, past its left and bottom edges, so the piece reads
 * as a close-up of the whole tree. `t` runs from 0, the rising curve, to 1, the flat branch under
 * the open misses drawer. The motion pass animates `t`; today it is 0 or 1.
 */

export const TREE_WIDTH = 390;
export const TREE_HEIGHT = 368;
/** Height of the flat layout with its labels hanging below, for the open drawer's top edge. */
export const FLAT_HEIGHT = 124;

type Point = readonly [number, number];

interface Shape {
	/** Earlier nodes, oldest first. */
	nodes: readonly Point[];
	leaf: Point;
	/** One quadratic control point per edge, into each node after the first and into the leaf. */
	controls: readonly Point[];
	trunk: readonly [Point, Point, Point];
	/** How far right of each earlier node its label starts, and how far left of the leaf its label ends. */
	labelDx: readonly number[];
	leafDx: number;
}

// The approved frames, measured from the bottom of the top bar. Two earlier nodes rise in a curve;
// one earlier node (the first path on a branch) takes a single long edge.
const CURVE: Record<0 | 1 | 2, Shape> = {
	2: {
		nodes: [
			[34, 292],
			[172, 172]
		],
		leaf: [300, 58],
		controls: [
			[54, 188],
			[262, 148]
		],
		trunk: [
			[-60, 398],
			[-10, 348],
			[18, 310]
		],
		labelDx: [32, 36],
		leafDx: -64
	},
	1: {
		nodes: [[52, 280]],
		leaf: [285, 78],
		controls: [[110, 108]],
		trunk: [
			[-60, 398],
			[-6, 348],
			[34, 298]
		],
		labelDx: [34],
		leafDx: -63
	},
	0: { nodes: [], leaf: [285, 78], controls: [], trunk: [[0, 0], [0, 0], [0, 0]], labelDx: [], leafDx: -63 }
};

const FLAT_Y = 44;
const FLAT: Record<0 | 1 | 2, { nodes: readonly Point[]; leaf: Point }> = {
	2: {
		nodes: [
			[46, FLAT_Y],
			[195, FLAT_Y]
		],
		leaf: [335, FLAT_Y]
	},
	1: { nodes: [[60, FLAT_Y]], leaf: [335, FLAT_Y] },
	0: { nodes: [], leaf: [335, FLAT_Y] }
};

/** Node sizes: earlier nodes and the leaf are drawn 1.3x on the curve, smaller when flat. */
const LEAF_R = { curve: 44, flat: 28 };
const NODE_SCALE = { curve: 1.3, flat: [0.85, 0.8] };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: Point, b: Point, t: number): [number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

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
	leaf: Placed & { r: number; ring: number; score: number };
	edges: string[];
	trunk: string | null;
}

export function trailLayout(earlierCount: number, t: number): TrailLayout {
	const count = Math.min(2, Math.max(0, earlierCount)) as 0 | 1 | 2;
	const curve = CURVE[count];
	const flatShape = FLAT[count];
	const flat = t > 0.5;
	const r = lerp(LEAF_R.curve, LEAF_R.flat, t);
	const below = LEAF_R.flat + 6;
	const [lx, ly] = mix(curve.leaf, flatShape.leaf, t);
	const earlier = curve.nodes.map((point, index) => {
		const [x, y] = mix(point, flatShape.nodes[index]!, t);
		const flatScale = NODE_SCALE.flat[index === curve.nodes.length - 1 && count === 2 ? 1 : 0]!;
		return {
			x,
			y,
			scale: lerp(NODE_SCALE.curve, flatScale, t),
			label: flat ? { x, y: y + below, align: 'center' as const, below: true } : { x: x + curve.labelDx[index]!, y, align: 'start' as const, below: false }
		};
	});
	const points: [number, number][] = [...earlier.map((node) => [node.x, node.y] as [number, number]), [lx, ly]];
	const edges: string[] = [];
	for (let index = 1; index < points.length; index++) {
		const [ax, ay] = points[index - 1]!;
		const [bx, by] = points[index]!;
		// Flat, the control point sits on the line, so the edge is straight.
		const [cx, cy] = mix(curve.controls[index - 1]!, [(ax + bx) / 2, (ay + by) / 2], t);
		edges.push(`M${ax} ${ay} Q${cx} ${cy} ${bx} ${by}`);
	}
	let trunk: string | null = null;
	if (count > 0) {
		const [first] = points;
		const [start, control, end] = curve.trunk;
		const flatEnd: Point = [first![0] - 20, first![1]];
		const [sx, sy] = mix(start, [-60, FLAT_Y], t);
		const [cx, cy] = mix(control, [(flatEnd[0] - 60) / 2, FLAT_Y], t);
		const [ex, ey] = mix(end, flatEnd, t);
		trunk = `M${sx} ${sy} Q${cx} ${cy} ${ex} ${ey}`;
	}
	return {
		earlier,
		leaf: {
			x: lx,
			y: ly,
			r,
			ring: lerp(8, 6, t),
			score: lerp(18, 13, t),
			scale: 1,
			label: flat ? { x: lx, y: ly + below, align: 'center', below: true } : { x: lx + curve.leafDx, y: ly, align: 'end', below: false }
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
