import { describe, expect, it } from 'vitest';
import { loadCurriculum } from '../content/loadCurriculum.ts';
import { loadDecks } from '../content/loadDecks.ts';
import { lessonTrail } from '../domain/trail.ts';
import { placeLabels } from './labelPlacement.ts';
import { LABEL_FORMS, NODE_R, TREE_HEIGHT, TREE_WIDTH, labelScene, trailLayout, treeBoxHeight } from './trailGeometry.ts';

// Every trail the curriculum can produce, placed at every screen size the summary supports. The
// component measures real text; here widths are estimated on the wide side (0.62em per character,
// greedy wrapping), so a pass here leaves room for the real font.

const curriculum = loadCurriculum('content/curriculum', 'content/decks');
const decks = loadDecks('content/decks');
const trails = decks.map((deck) => lessonTrail(curriculum, [], deck.id, deck.title));

function measure(text: string, size: number, line: number, wrap: number | null) {
	const char = size * 0.62;
	if (wrap === null) return { w: Math.ceil(text.length * char), h: line };
	const lines: string[] = [];
	for (const word of text.split(' ')) {
		const last = lines.at(-1);
		if (last !== undefined && (last.length + 1 + word.length) * char <= wrap) lines[lines.length - 1] = `${last} ${word}`;
		else lines.push(word);
	}
	return { w: Math.ceil(Math.max(...lines.map((one) => one.length * char))), h: lines.length * line };
}

interface View {
	name: string;
	width: number;
	scale: number;
	nodeScale: number;
	flat: boolean;
	/** Label sizes: earlier labels, then this lesson's. */
	fonts: [number, number, number, number];
}

const phones: View[] = [320, 360, 375, 390, 414, 430, 768, 1023].flatMap((width) =>
	[false, true].map((flat) => ({ name: `phone ${width}${flat ? ' flat' : ''}`, width, scale: Math.min(width / TREE_WIDTH, 1.25), nodeScale: 1, flat, fonts: [14, 20, 16, 24] as View['fonts'] }))
);
const desktops: View[] = [
	[560, 640],
	[820, 760],
	[1100, 800]
].map(([width, height]) => ({
	name: `desktop ${width}x${height}`,
	width: width!,
	scale: Math.max(0.5, Math.min(width! / TREE_WIDTH, height! / TREE_HEIGHT, 2.2)),
	nodeScale: 0.6,
	flat: false,
	fonts: [16, 24, 20, 28]
}));

describe('summary tree labels across the curriculum', () => {
	it('has trails of every shape to check', () => {
		expect(new Set(trails.map((trail) => trail.earlier.length))).toEqual(new Set([0, 1, 2]));
	});

	for (const view of [...phones, ...desktops]) {
		it(`places every label clear of nodes, edges and each other, 8px inside the box (${view.name})`, () => {
			const misses: string[] = [];
			for (const trail of trails) {
				const texts = [...trail.earlier.map((node) => node.title), trail.title];
				const layout = trailLayout(trail.earlier.length, view.flat ? 1 : 0);
				const scene = labelScene(layout, view, (index, form) => {
					const current = index === texts.length - 1;
					const [size, line] = current ? [view.fonts[2], view.fonts[3]] : [view.fonts[0], view.fonts[1]];
					return measure(texts[index]!, form.small ? size - 1 : size, form.small ? line - 2 : line, form.wrap);
				});
				const placements = placeLabels(scene.requests, scene.obstacles, scene.box);
				placements.forEach((place, index) => {
					if (!place) misses.push(`${texts[index]} (in ${texts.join(' > ')})`);
				});
			}
			expect(misses).toEqual([]);
		});
	}

	it('keeps every node fully on screen, at every size and both layouts', () => {
		for (const view of [...phones, ...desktops]) {
			for (const count of [0, 1, 2]) {
				const layout = trailLayout(count, view.flat ? 1 : 0);
				const height = treeBoxHeight(view.flat, view.scale);
				const circles = [
					...layout.earlier.map((node) => ({ x: node.x, y: node.y, r: NODE_R * node.scale * view.nodeScale })),
					{ x: layout.leaf.x, y: layout.leaf.y, r: layout.leaf.r * view.nodeScale }
				].map((circle) => ({ x: circle.x * view.scale, y: circle.y * view.scale, r: circle.r * view.scale }));
				for (const circle of circles) {
					expect(circle.x - circle.r, view.name).toBeGreaterThanOrEqual(0);
					expect(circle.x + circle.r, view.name).toBeLessThanOrEqual(view.width);
					expect(circle.y - circle.r, view.name).toBeGreaterThanOrEqual(0);
					expect(circle.y + circle.r, view.name).toBeLessThanOrEqual(height);
				}
			}
		}
	});

	it('uses every form only when needed: most labels fit on one line at full size on a 390px phone', () => {
		const view = phones.find((one) => one.name === 'phone 390')!;
		let full = 0;
		let total = 0;
		for (const trail of trails) {
			const texts = [...trail.earlier.map((node) => node.title), trail.title];
			const scene = labelScene(trailLayout(trail.earlier.length, 0), view, (index, form) =>
				measure(texts[index]!, form.small ? 13 : 14, 20, form.wrap)
			);
			for (const place of placeLabels(scene.requests, scene.obstacles, scene.box)) {
				total += 1;
				if (place && !place.small) full += 1;
			}
		}
		expect(full / total).toBeGreaterThan(0.8);
		expect(LABEL_FORMS).toHaveLength(6);
	});
});
