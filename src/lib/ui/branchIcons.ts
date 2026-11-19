/**
 * One small line icon per curriculum branch, ported from the tree mock's `branchIcon`. Built as the
 * same `Shape` geometry as the status glyphs, so `drawShapes` draws it on a canvas and
 * `BranchIcon.svelte` renders it as SVG. `u` is the icon's half-size: it spans about 2u.
 */

import { drawShapes, type Seg, type Shape } from './glyphs';

const TAU = Math.PI * 2;
const line = (x0: number, y0: number, x1: number, y1: number): Seg[] => [
	{ k: 'M', x: x0, y: y0 },
	{ k: 'L', x: x1, y: y1 }
];
const dot = (cx: number, cy: number, r: number): Seg[] => [{ k: 'M', x: cx + r, y: cy }, { k: 'A', cx, cy, r, a0: 0, a1: TAU }, { k: 'Z' }];

export function branchIconShapes(id: string, x: number, y: number, u: number, color: string): Shape[] {
	const stroke = (segs: Seg[], cap: CanvasLineCap = 'round'): Shape => ({
		kind: 'path',
		segs,
		stroke: color,
		width: Math.max(1.4, u * 0.16),
		cap,
		join: 'round'
	});
	const fill = (segs: Seg[]): Shape => ({ kind: 'path', segs, fill: color });

	switch (id) {
		// three lines, longest at the bottom: a base to build on
		case 'foundations':
			return [
				stroke(
					(
						[
							[-0.7, 0.45, 1.4],
							[-0.5, 0, 1],
							[-0.3, -0.45, 0.6]
						] as const
					).flatMap(([a, b, w]) => line(x + a * u, y + b * u, x + (a + w) * u, y + b * u))
				)
			];
		// an array of four cells (one frame, single dividers) with a pointer over the second cell
		case 'sequences-and-search': {
			const top = y - 0.14 * u;
			const bottom = y + 0.46 * u;
			const cx = x - 0.225 * u;
			return [
				stroke([{ k: 'M', x: x - 0.9 * u, y: top }, { k: 'L', x: x + 0.9 * u, y: top }, { k: 'L', x: x + 0.9 * u, y: bottom }, { k: 'L', x: x - 0.9 * u, y: bottom }, { k: 'Z' }]),
				// dividers end exactly at the frame (butt caps), so nothing pokes through its edges
				stroke(
					[1, 2, 3].flatMap((i) => line(x + (-0.9 + i * 0.45) * u, top, x + (-0.9 + i * 0.45) * u, bottom)),
					'butt'
				),
				fill([{ k: 'M', x: cx - 0.18 * u, y: y - 0.62 * u }, { k: 'L', x: cx, y: y - 0.38 * u }, { k: 'L', x: cx + 0.18 * u, y: y - 0.62 * u }, { k: 'Z' }])
			];
		}
		// layers: the top layer is a full rhombus, each layer below shows only its lower chevron, evenly spaced
		case 'data-structures': {
			const t = y - 0.4 * u;
			const segs: Seg[] = [{ k: 'M', x: x - 0.7 * u, y: t }, { k: 'L', x, y: t - 0.25 * u }, { k: 'L', x: x + 0.7 * u, y: t }, { k: 'L', x, y: t + 0.25 * u }, { k: 'Z' }];
			for (const i of [1, 2]) {
				const yy = t + i * 0.4 * u;
				segs.push({ k: 'M', x: x - 0.7 * u, y: yy }, { k: 'L', x, y: yy + 0.25 * u }, { k: 'L', x: x + 0.7 * u, y: yy });
			}
			return [stroke(segs)];
		}
		// a root and two children
		case 'trees-and-graphs':
			return [
				stroke([...line(x, y - 0.45 * u, x - 0.55 * u, y + 0.4 * u), ...line(x, y - 0.45 * u, x + 0.55 * u, y + 0.4 * u)]),
				fill(
					(
						[
							[0, -0.45],
							[-0.55, 0.4],
							[0.55, 0.4]
						] as const
					).flatMap(([a, b]) => dot(x + a * u, y + b * u, 0.2 * u))
				)
			];
		// a 3x3 grid of dots with the diagonal joined; each link stops short of the dots it joins
		case 'problem-solving-patterns': {
			const dots: Seg[] = [];
			for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) dots.push(...dot(x + (-0.5 + j * 0.5) * u, y + (-0.5 + i * 0.5) * u, 0.12 * u));
			const links = [-0.5, 0].flatMap((k) => {
				const a = k + 0.5 * 0.38;
				const b = k + 0.5 * 0.62;
				return line(x + a * u, y + a * u, x + b * u, y + b * u);
			});
			return [fill(dots), stroke(links)];
		}
		// planned or unknown branches: a plus
		default:
			return [stroke([...line(x, y - 0.7 * u, x, y + 0.7 * u), ...line(x - 0.7 * u, y, x + 0.7 * u, y)])];
	}
}

export function drawBranchIcon(g: CanvasRenderingContext2D, id: string, x: number, y: number, u: number, color: string): void {
	drawShapes(g, branchIconShapes(id, x, y, u, color));
}
