import { describe, expect, it } from 'vitest';
import { ringArcs, trailLayout } from './trailGeometry';

describe('trailLayout', () => {
	it('puts one earlier node next to the leaf, and two in a rising curve', () => {
		const one = trailLayout(1, 0);
		const two = trailLayout(2, 0);
		expect(one.earlier).toHaveLength(1);
		expect(one.earlier[0]).toMatchObject({ x: two.earlier[1]!.x, y: two.earlier[1]!.y });
		expect(two.earlier[0]!.y).toBeGreaterThan(two.earlier[1]!.y);
		expect(two.earlier[1]!.y).toBeGreaterThan(two.leaf.y);
		expect(two.edges).toHaveLength(2);
		expect(trailLayout(0, 0)).toMatchObject({ earlier: [], edges: [], trunk: null });
	});

	it('lays every node on one line when flat, with labels centered below', () => {
		const flat = trailLayout(2, 1);
		const ys = [...flat.earlier.map((node) => node.y), flat.leaf.y];
		expect(new Set(ys).size).toBe(1);
		expect([...flat.earlier, flat.leaf].every((node) => node.label.align === 'center' && node.label.below)).toBe(true);
	});
});

describe('ringArcs', () => {
	it('draws one arc per question, and a whole ring for one question', () => {
		expect(ringArcs(31, 8)).toHaveLength(8);
		expect(ringArcs(31, 0)).toEqual([]);
		expect(ringArcs(31, 1)[0]).toContain(' 1 1 ');
	});
});
