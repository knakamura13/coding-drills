import { describe, expect, it } from 'vitest';
import { placeLabels, type LabelForm, type LabelRequest } from './labelPlacement';

const box = { w: 300, h: 200 };
const form = (w: number, h: number, wrap: number | null = null, small = false): LabelForm => ({ w, h, wrap, small });
const label = (x: number, y: number, forms: LabelForm[], sides: LabelRequest['sides'] = ['right', 'left', 'below', 'above']): LabelRequest => ({
	node: { x, y, r: 10 },
	forms,
	sides
});

describe('placeLabels', () => {
	it('takes the first side that is clear, beside its node with the gap', () => {
		const [place] = placeLabels([label(50, 100, [form(80, 20)])], [], box);
		expect(place).toMatchObject({ side: 'right', x: 68, y: 90, w: 80, h: 20 });
	});

	it('moves to another side when an obstacle or the box edge is in the way', () => {
		const [blocked] = placeLabels([label(50, 100, [form(80, 20)])], [{ x: 100, y: 100, r: 5 }], box);
		expect(blocked?.side).not.toBe('right');
		const [edge] = placeLabels([label(280, 100, [form(80, 20)])], [], box);
		expect(edge?.side).toBe('left');
	});

	it('falls back to wrapped, then smaller forms, in order', () => {
		// Right of the node, a label has 112 - 38 = 74px before the 8px inset.
		const narrow = { w: 120, h: 60 };
		const [place] = placeLabels([label(20, 30, [form(200, 20), form(90, 40, 96), form(70, 18, null, true)], ['right'])], [], narrow);
		expect(place).toMatchObject({ wrap: null, small: true });
	});

	it('keeps labels off each other', () => {
		const [a, b] = placeLabels([label(50, 100, [form(80, 20)]), label(50, 104, [form(80, 20)], ['right', 'below'])], [], box);
		expect(a?.side).toBe('right');
		expect(b?.side).toBe('below');
	});

	it('keeps every label 8px inside the box', () => {
		const [place] = placeLabels([label(10, 100, [form(80, 20)], ['below'])], [], box);
		expect(place?.x).toBe(8);
		expect(placeLabels([label(100, 5, [form(40, 20)], ['above'])], [], box)).toEqual([null]);
	});

	it('gives up with null rather than overlap', () => {
		const [place] = placeLabels([label(50, 100, [form(400, 20)])], [], box);
		expect(place).toBeNull();
	});
});
