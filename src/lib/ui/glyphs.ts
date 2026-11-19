/**
 * Every status shape in the app, ported from the tree mock's `drawGlyph`. Each shape is built once
 * as plain geometry (`Shape[]`), then drawn to a canvas by `drawShapes` or turned into SVG path data
 * by `svgPath`, so the tree and the HTML rows show the same pixels.
 *
 * Standard shapes, no legend: empty circle = not started, half-filled = started, filled with a check
 * = done, rose with "!" = missed, lock = locked. A checkpoint is a diamond with a flag when its exam is
 * ready, filled with a check when passed, rose with an "x" when failed.
 *
 * Clean at any zoom: closed outlines have no line caps (so a translucent stroke never doubles where it
 * starts), the lock's shackle ends exactly at its body, and nothing translucent overlaps itself.
 */

import { COLORS, hexA } from './palette';

const TAU = Math.PI * 2;

/** One step of a path. `A` is a canvas-style arc: clockwise on screen from `a0` to `a1` (radians). */
export type Seg =
	| { k: 'M'; x: number; y: number }
	| { k: 'L'; x: number; y: number }
	| { k: 'A'; cx: number; cy: number; r: number; a0: number; a1: number }
	| { k: 'Z' };

export interface PathShape {
	kind: 'path';
	segs: Seg[];
	fill?: string;
	stroke?: string;
	width?: number;
	cap?: CanvasLineCap;
	join?: CanvasLineJoin;
	dash?: readonly [number, number];
}

export interface TextShape {
	kind: 'text';
	text: string;
	x: number;
	y: number;
	size: number;
	weight: number;
	fill: string;
}

export type Shape = PathShape | TextShape;

/** A tree node's status. `failed` is a path whose exam was failed; it reads as "needs attention". */
export type NodeState = 'open' | 'practicing' | 'mastered' | 'missed' | 'failed' | 'locked' | 'planned';
/** `sealed`: its skills are not all mastered yet. `locked`: the whole path is locked. */
export type CheckpointState = 'available' | 'passed' | 'failed' | 'sealed' | 'locked';
export type GlyphKind = 'skill' | 'path' | 'branch' | 'checkpoint';

export interface GlyphOptions {
	/** Due review cards. Draws a rose badge at the top right, with the count when it fits. */
	due?: number;
	/** For a path: skills mastered and in total. Draws the progress ring. */
	mastered?: number;
	total?: number;
}

const LOCK_TONE = 'rgba(148,163,184,.7)';
const SEALED_TONE = 'rgba(148,163,184,.5)';
const ON_FILL = '#0a1220';
const BODY = '#0d1526';
const LOCKED_BODY = '#0a101c';
const DIAMOND_BODY = '#0c1424';

const circle = (cx: number, cy: number, r: number): Seg[] => [{ k: 'A', cx, cy, r, a0: 0, a1: TAU }, { k: 'Z' }];

/** A rounded rectangle, optionally turned by `turn` radians around (`ox`, `oy`). */
export function roundRect(x: number, y: number, w: number, h: number, r: number, turn = 0, ox = 0, oy = 0): Seg[] {
	const cos = Math.cos(turn);
	const sin = Math.sin(turn);
	const at = (px: number, py: number) => ({ x: ox + (px - ox) * cos - (py - oy) * sin, y: oy + (px - ox) * sin + (py - oy) * cos });
	const arc = (cx: number, cy: number, a0: number): Seg => {
		const c = at(cx, cy);
		return { k: 'A', cx: c.x, cy: c.y, r, a0: a0 + turn, a1: a0 + turn + Math.PI / 2 };
	};
	return [
		{ k: 'M', ...at(x + r, y) },
		arc(x + w - r, y + r, -Math.PI / 2),
		arc(x + w - r, y + h - r, 0),
		arc(x + r, y + h - r, Math.PI / 2),
		arc(x + r, y + r, Math.PI),
		{ k: 'Z' }
	];
}

// ---------- the small marks inside a glyph ----------

/** A padlock. The shackle's butt caps end exactly at the body's top edge, so a translucent lock has no darker overlap. */
export function lockShapes(x: number, y: number, u: number, color: string): Shape[] {
	const w = u * 1.15;
	return [
		{ kind: 'path', segs: [{ k: 'A', cx: x, cy: y - u * 0.12, r: u * 0.42, a0: Math.PI, a1: TAU }], stroke: color, width: Math.max(1.2, u * 0.22), cap: 'butt' },
		{ kind: 'path', segs: roundRect(x - w / 2, y - u * 0.12, w, u * 0.9, u * 0.2), fill: color }
	];
}

export function checkShapes(x: number, y: number, u: number, color: string): Shape[] {
	return [
		{
			kind: 'path',
			segs: [
				{ k: 'M', x: x - u * 0.5, y: y + u * 0.02 },
				{ k: 'L', x: x - u * 0.14, y: y + u * 0.38 },
				{ k: 'L', x: x + u * 0.55, y: y - u * 0.38 }
			],
			stroke: color,
			width: Math.max(1.5, u * 0.28),
			cap: 'round',
			join: 'round'
		}
	];
}

export function bangShapes(x: number, y: number, u: number, color: string): Shape[] {
	return [
		{ kind: 'path', segs: [{ k: 'M', x, y: y - u * 0.55 }, { k: 'L', x, y: y + u * 0.12 }], stroke: color, width: Math.max(1.6, u * 0.3), cap: 'round' },
		{ kind: 'path', segs: circle(x, y + u * 0.5, Math.max(1, u * 0.16)), fill: color }
	];
}

export function crossShapes(x: number, y: number, u: number, color: string): Shape[] {
	const d = u * 0.42;
	return [
		{
			kind: 'path',
			segs: [
				{ k: 'M', x: x - d, y: y - d },
				{ k: 'L', x: x + d, y: y + d },
				{ k: 'M', x: x + d, y: y - d },
				{ k: 'L', x: x - d, y: y + d }
			],
			stroke: color,
			width: Math.max(1.6, u * 0.28),
			cap: 'round'
		}
	];
}

export function flagShapes(x: number, y: number, u: number, color: string): Shape[] {
	const pole = x - u * 0.38;
	return [
		{ kind: 'path', segs: [{ k: 'M', x: pole, y: y + u * 0.6 }, { k: 'L', x: pole, y: y - u * 0.6 }], stroke: color, width: Math.max(1.3, u * 0.18), cap: 'round' },
		{
			kind: 'path',
			segs: [{ k: 'M', x: pole, y: y - u * 0.6 }, { k: 'L', x: x + u * 0.55, y: y - u * 0.3 }, { k: 'L', x: pole, y: y + u * 0.02 }, { k: 'Z' }],
			fill: color
		}
	];
}

// ---------- the glyph ----------

/** The due badge's radius for a glyph of radius `r`. */
const badgeRadius = (r: number) => (r < 9 ? 3.2 : Math.max(5.5, r * 0.36));

/** The rose badge for due review cards. It shows the count only where the digits stay legible. */
export function dueShapes(x: number, y: number, r: number, due: number): Shape[] {
	const bx = x + r * 0.78;
	const by = y - r * 0.78;
	const br = badgeRadius(r);
	const shapes: Shape[] = [
		{ kind: 'path', segs: circle(bx, by, br + 1.5), fill: COLORS.bg },
		{ kind: 'path', segs: circle(bx, by, br), fill: COLORS.rose }
	];
	if (br >= 6.5) shapes.push({ kind: 'text', text: String(due), x: bx, y: by + 0.5, size: Math.round(br * 1.25), weight: 700, fill: '#fff' });
	return shapes;
}

function checkpointShapes(x: number, y: number, r: number, state: CheckpointState): Shape[] {
	const s = r * 1.15;
	const diamond = roundRect(x - s, y - s, s * 2, s * 2, s * 0.25, Math.PI / 4, x, y);
	const tone = state === 'passed' || state === 'available' ? COLORS.gold : state === 'failed' ? COLORS.rose : SEALED_TONE;
	const body: Shape =
		state === 'passed'
			? { kind: 'path', segs: diamond, fill: COLORS.gold }
			: { kind: 'path', segs: diamond, fill: DIAMOND_BODY, stroke: tone, width: Math.max(1.4, r * 0.2) };
	const mark =
		state === 'passed'
			? checkShapes(x, y, r * 0.7, '#1a1406')
			: state === 'available'
				? flagShapes(x, y, r * 0.62, COLORS.gold)
				: state === 'failed'
					? crossShapes(x, y, r * 0.62, COLORS.rose)
					: lockShapes(x, y + r * 0.05, r * 0.55, 'rgba(148,163,184,.75)');
	return [body, ...mark];
}

function nodeShapes(kind: Exclude<GlyphKind, 'checkpoint'>, x: number, y: number, r: number, state: NodeState, color: string, options: GlyphOptions): Shape[] {
	const filled = state === 'mastered';
	const alert = state === 'missed' || state === 'failed';
	const stroke = filled
		? hexA(color, 0.95)
		: alert
			? COLORS.rose
			: state === 'practicing'
				? color
				: state === 'open'
					? 'rgba(214,224,240,.7)'
					: state === 'planned'
						? hexA(color, 0.5)
						: 'rgba(148,163,184,.4)';
	const shapes: Shape[] = [
		{
			kind: 'path',
			segs: circle(x, y, r),
			fill: filled ? color : state === 'locked' ? LOCKED_BODY : BODY,
			stroke,
			width: Math.max(1.4, r * 0.16),
			dash: state === 'planned' ? [r * 0.5, r * 0.35] : undefined
		}
	];
	const { mastered = 0, total = 0 } = options;
	// The ring starts empty rather than as a zero-length arc, which round caps would draw as a dot.
	if (kind === 'path' && total > 0 && mastered > 0 && !filled && state !== 'locked') {
		const a0 = -Math.PI / 2;
		shapes.push({
			kind: 'path',
			segs: [{ k: 'A', cx: x, cy: y, r: r + Math.max(3, r * 0.28), a0, a1: a0 + TAU * Math.min(1, mastered / total) }],
			stroke: alert ? COLORS.rose : color,
			width: Math.max(2, r * 0.16),
			cap: 'round'
		});
	}
	if (filled) shapes.push(...checkShapes(x, y, r * 0.5, ON_FILL));
	else if (alert) shapes.push(...bangShapes(x, y, r * 0.55, COLORS.rose));
	else if (state === 'locked') shapes.push(...lockShapes(x, y + r * 0.05, r * 0.5, LOCK_TONE));
	else if (state === 'practicing' && kind !== 'path') {
		shapes.push({
			kind: 'path',
			segs: [{ k: 'M', x, y }, { k: 'A', cx: x, cy: y, r: r * 0.62, a0: -Math.PI / 2, a1: Math.PI / 2 }, { k: 'Z' }],
			fill: color
		});
	}
	return shapes;
}

/**
 * The shapes for one node glyph centred on (`x`, `y`) with body radius `r`. `color` is the branch
 * color as `#rrggbb`. A checkpoint takes a `CheckpointState`, every other kind a `NodeState`.
 */
export function glyphShapes(kind: 'checkpoint', x: number, y: number, r: number, state: CheckpointState, color?: string, options?: GlyphOptions): Shape[];
export function glyphShapes(kind: Exclude<GlyphKind, 'checkpoint'>, x: number, y: number, r: number, state: NodeState, color: string, options?: GlyphOptions): Shape[];
export function glyphShapes(kind: GlyphKind, x: number, y: number, r: number, state: NodeState | CheckpointState, color = COLORS.gold, options: GlyphOptions = {}): Shape[] {
	const shapes =
		kind === 'checkpoint' ? checkpointShapes(x, y, r, state as CheckpointState) : nodeShapes(kind, x, y, r, state as NodeState, color, options);
	if (options.due) shapes.push(...dueShapes(x, y, r, options.due));
	return shapes;
}

/**
 * How far a glyph's drawn shape reaches from its centre: body, path progress ring, checkpoint diamond
 * and due badge. Use it to keep labels clear of nodes.
 */
export function glyphExtent(kind: GlyphKind, state: NodeState | CheckpointState, r: number, options: GlyphOptions = {}): number {
	let reach = kind === 'checkpoint' ? r * 1.15 * Math.SQRT2 + 1 : r + 2;
	if (kind === 'path' && options.total && options.mastered && state !== 'mastered' && state !== 'locked') {
		reach = r + Math.max(3, r * 0.28) + Math.max(2, r * 0.16) / 2 + 1;
	}
	if (options.due && kind !== 'branch') reach = Math.max(reach, r * 0.78 * Math.SQRT2 + badgeRadius(r) + 1.5);
	return reach;
}

// ---------- renderers ----------

/** Draws shapes to a 2D canvas context. Every line style is set per shape, so earlier drawing never leaks in. */
export function drawShapes(g: CanvasRenderingContext2D, shapes: readonly Shape[]): void {
	for (const shape of shapes) {
		if (shape.kind === 'text') {
			g.fillStyle = shape.fill;
			g.font = `${shape.weight} ${shape.size}px Inter, ui-sans-serif, system-ui, sans-serif`;
			g.textAlign = 'center';
			g.textBaseline = 'middle';
			g.fillText(shape.text, shape.x, shape.y);
			continue;
		}
		g.beginPath();
		for (const seg of shape.segs) {
			if (seg.k === 'M') g.moveTo(seg.x, seg.y);
			else if (seg.k === 'L') g.lineTo(seg.x, seg.y);
			else if (seg.k === 'A') g.arc(seg.cx, seg.cy, seg.r, seg.a0, seg.a1);
			else g.closePath();
		}
		if (shape.fill) {
			g.fillStyle = shape.fill;
			g.fill();
		}
		if (shape.stroke) {
			g.strokeStyle = shape.stroke;
			g.lineWidth = shape.width ?? 1;
			g.lineCap = shape.cap ?? 'butt';
			g.lineJoin = shape.join ?? 'miter';
			g.setLineDash(shape.dash ? [...shape.dash] : []);
			g.stroke();
			g.setLineDash([]);
		}
	}
}

/** Draws one glyph. The same arguments as `glyphShapes`, with the context first. */
export function drawGlyph(
	g: CanvasRenderingContext2D,
	kind: GlyphKind,
	x: number,
	y: number,
	r: number,
	state: NodeState | CheckpointState,
	color: string,
	options: GlyphOptions = {}
): void {
	drawShapes(g, glyphShapes(kind as 'skill', x, y, r, state as NodeState, color, options));
}

const num = (n: number) => String(Math.round(n * 1000) / 1000);

/** SVG path data for the same segments, with arcs drawn exactly as canvas `arc` draws them. */
export function svgPath(segs: readonly Seg[]): string {
	let d = '';
	let cur: { x: number; y: number } | null = null;
	let start: { x: number; y: number } | null = null;
	for (const seg of segs) {
		if (seg.k === 'M' || seg.k === 'L') {
			d += `${seg.k}${num(seg.x)} ${num(seg.y)}`;
			cur = { x: seg.x, y: seg.y };
			if (seg.k === 'M') start = cur;
		} else if (seg.k === 'Z') {
			d += 'Z';
			cur = start;
		} else {
			const point = (a: number) => ({ x: seg.cx + seg.r * Math.cos(a), y: seg.cy + seg.r * Math.sin(a) });
			const from = point(seg.a0);
			// Like canvas: an arc starts a new subpath, or joins the current point with a line.
			if (!cur) {
				d += `M${num(from.x)} ${num(from.y)}`;
				start = from;
			} else if (Math.hypot(cur.x - from.x, cur.y - from.y) > 1e-6) d += `L${num(from.x)} ${num(from.y)}`;
			const sweep = Math.min(seg.a1 - seg.a0, TAU);
			// SVG cannot draw a whole circle as one arc, so it is split in two.
			const steps = sweep >= TAU - 1e-9 ? [seg.a0 + sweep / 2, seg.a0 + sweep] : [seg.a0 + sweep];
			for (const a of steps) {
				const to = point(a);
				const large = sweep / steps.length > Math.PI ? 1 : 0;
				d += `A${num(seg.r)} ${num(seg.r)} 0 ${large} 1 ${num(to.x)} ${num(to.y)}`;
			}
			cur = point(seg.a0 + sweep);
		}
	}
	return d;
}
