/**
 * Where the summary's tree piece draws (lesson Round 6b, Bleed B: Zoomed in), in a box one phone
 * screen wide. The trunk starts outside the box, past its left and bottom edges, so the piece reads
 * as a close-up of the whole tree. `t` runs from 0, the rising curve, to 1, the flat branch under
 * the open misses drawer. The motion pass animates `t`; today it is 0 or 1.
 */

export const TREE_WIDTH = 390;
export const TREE_HEIGHT = 368;
/**
 * The tree box's height in px. Flat, the labels hang below the nodes in text that does not scale
 * with the drawing, so the box is the drawing's part plus room for four lines of labels (three
 * lines, or a staggered row of two).
 */
export function treeBoxHeight(flat: boolean, scale: number): number {
	return flat ? (FLAT_Y + LEAF_R.flat) * scale + 8 + 4 * 24 + 8 : TREE_HEIGHT * scale;
}

import type { Circle, LabelForm, LabelRequest, Side, Size } from './labelPlacement';

export type Point = readonly [number, number];

interface Shape {
	/** Earlier nodes, oldest first. */
	nodes: readonly Point[];
	leaf: Point;
	/** One quadratic control point per edge, into each node after the first and into the leaf. */
	controls: readonly Point[];
	/** Where the trunk starts, past the box's left and bottom edges, and its control point. */
	trunk: readonly [Point, Point];
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
			[-10, 348]
		]
	},
	1: {
		nodes: [[52, 280]],
		leaf: [285, 78],
		controls: [[110, 108]],
		trunk: [
			[-60, 398],
			[-6, 348]
		]
	},
	0: { nodes: [], leaf: [285, 78], controls: [], trunk: [[0, 0], [0, 0]] }
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

/** A quadratic curve in drawing units. */
export interface Curve {
	from: Point;
	control: Point;
	to: Point;
}

export interface TrailNode {
	x: number;
	y: number;
	/** Draw scale of the node; its outer radius is `NODE_R * scale`. */
	scale: number;
}

export interface TrailLayout {
	/** One per earlier node, oldest first. */
	earlier: TrailNode[];
	/** The leaf: `r` is the ring's outer radius. */
	leaf: { x: number; y: number; r: number; ring: number; score: number };
	/**
	 * Every edge and the trunk run center to center, under the nodes, which are opaque. However the
	 * nodes are sized, an edge always reaches its node: there is no endpoint to fall short.
	 */
	edges: Curve[];
	trunk: Curve | null;
}

/** Outer radius of an earlier node at scale 1 (the lesson circle; the branch circle is smaller). */
export const NODE_R = 20;

export function trailLayout(earlierCount: number, t: number): TrailLayout {
	const count = Math.min(2, Math.max(0, earlierCount)) as 0 | 1 | 2;
	const curve = CURVE[count];
	const flatShape = FLAT[count];
	const [lx, ly] = mix(curve.leaf, flatShape.leaf, t);
	const earlier = curve.nodes.map((point, index) => {
		const [x, y] = mix(point, flatShape.nodes[index]!, t);
		const flatScale = NODE_SCALE.flat[index === curve.nodes.length - 1 && count === 2 ? 1 : 0]!;
		return { x, y, scale: lerp(NODE_SCALE.curve, flatScale, t) };
	});
	const centers: Point[] = [...earlier.map((node) => [node.x, node.y] as Point), [lx, ly]];
	const edges: Curve[] = [];
	for (let index = 1; index < centers.length; index++) {
		const from = centers[index - 1]!;
		const to = centers[index]!;
		// Flat, the control point sits on the line, so the edge is straight.
		const control = mix(curve.controls[index - 1]!, [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2], t);
		edges.push({ from, control, to });
	}
	let trunk: Curve | null = null;
	if (count > 0) {
		const to = centers[0]!;
		const from = mix(curve.trunk[0], [-60, FLAT_Y], t);
		const control = mix(curve.trunk[1], [(to[0] - 60) / 2, FLAT_Y], t);
		trunk = { from, control, to };
	}
	return {
		earlier,
		leaf: { x: lx, y: ly, r: lerp(LEAF_R.curve, LEAF_R.flat, t), ring: lerp(8, 6, t), score: lerp(18, 13, t) },
		edges,
		trunk
	};
}

export function curvePath({ from, control, to }: Curve): string {
	return `M${from[0]} ${from[1]} Q${control[0]} ${control[1]} ${to[0]} ${to[1]}`;
}

/** Points along a curve, about `step` units apart, ends included. */
export function sampleCurve({ from, control, to }: Curve, step = 3): Point[] {
	const length = Math.hypot(control[0] - from[0], control[1] - from[1]) + Math.hypot(to[0] - control[0], to[1] - control[1]);
	const count = Math.max(2, Math.ceil(length / step));
	return Array.from({ length: count + 1 }, (_, index) => {
		const u = index / count;
		const a = (1 - u) * (1 - u);
		const b = 2 * (1 - u) * u;
		const c = u * u;
		return [a * from[0] + b * control[0] + c * to[0], a * from[1] + b * control[1] + c * to[1]] as Point;
	});
}

/** The label forms, best first: one line, wrapped to 140px, then to 96px, then the same a size smaller. */
export const LABEL_FORMS = [
	{ wrap: null, small: false },
	{ wrap: 140, small: false },
	{ wrap: 96, small: false },
	{ wrap: null, small: true },
	{ wrap: 140, small: true },
	{ wrap: 96, small: true }
] as const satisfies readonly Omit<LabelForm, 'w' | 'h'>[];

/**
 * On the curve, labels sit beside their nodes, where a wider wrap fits best. Flat, they hang below
 * nodes about 130 units apart, so the narrow wrap comes first and the wide one last.
 */
function formOrder(flat: boolean): (typeof LABEL_FORMS)[number][] {
	if (!flat) return [...LABEL_FORMS];
	const rank = (form: (typeof LABEL_FORMS)[number]) => (form.wrap === 140 ? 2 : 0) + (form.small ? 1 : 0);
	return [...LABEL_FORMS].sort((a, b) => rank(a) - rank(b));
}

export interface LabelScene {
	requests: LabelRequest[];
	/** Every node, and points along every edge and the trunk, in px. */
	obstacles: Circle[];
	box: Size;
}

/**
 * What the label placement works on, in px: one request per label (earlier nodes oldest first,
 * then the leaf), and everything a label must clear. `measure` gives a label's size in a form.
 */
export function labelScene(
	layout: TrailLayout,
	view: { scale: number; nodeScale: number; width: number; flat: boolean },
	measure: (index: number, form: (typeof LABEL_FORMS)[number]) => Size
): LabelScene {
	const { scale, nodeScale, width, flat } = view;
	const nodes: Circle[] = [
		...layout.earlier.map((node) => ({ x: node.x * scale, y: node.y * scale, r: NODE_R * node.scale * nodeScale * scale })),
		{ x: layout.leaf.x * scale, y: layout.leaf.y * scale, r: layout.leaf.r * nodeScale * scale }
	];
	const curves = [...layout.edges, ...(layout.trunk ? [layout.trunk] : [])];
	// Edges are 2 units wide: each sample stands for its half width plus a pixel.
	const samples = curves.flatMap((curve) => sampleCurve(curve).map(([x, y]) => ({ x: x * scale, y: y * scale, r: scale + 1 })));
	const sides = (leaf: boolean): Side[] => (flat ? ['below', 'lower'] : leaf ? ['left', 'right', 'above', 'below'] : ['right', 'left', 'below', 'above']);
	return {
		requests: nodes.map((node, index) => ({
			node,
			forms: formOrder(flat).map((form) => ({ ...form, ...measure(index, form) })),
			sides: sides(index === nodes.length - 1)
		})),
		obstacles: [...nodes, ...samples],
		box: { w: width, h: treeBoxHeight(flat, scale) }
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
