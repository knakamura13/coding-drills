import { describe, expect, it } from 'vitest';
import { TREE_HEIGHT, ringArcs, trailLayout } from './trailGeometry';

describe('trailLayout', () => {
	it('rises from the branch to the leaf, with the trunk starting past the left and bottom edges', () => {
		const two = trailLayout(2, 0);
		expect(two.earlier[0]!.y).toBeGreaterThan(two.earlier[1]!.y);
		expect(two.earlier[1]!.y).toBeGreaterThan(two.leaf.y);
		expect(two.edges).toHaveLength(2);
		const [, startX, startY] = two.trunk!.match(/^M(-?[\d.]+) (-?[\d.]+)/)!.map(Number);
		expect(startX).toBeLessThan(0);
		expect(startY).toBeGreaterThan(TREE_HEIGHT);
	});

	it('gives the first path one long edge from the branch to the leaf, and a lone leaf none', () => {
		const one = trailLayout(1, 0);
		expect(one.earlier).toHaveLength(1);
		expect(one.edges).toHaveLength(1);
		expect(one.trunk).not.toBeNull();
		expect(trailLayout(0, 0)).toMatchObject({ earlier: [], edges: [], trunk: null });
	});

	it('draws nodes larger on the curve than flat', () => {
		expect(trailLayout(2, 0).earlier[0]!.scale).toBeGreaterThan(trailLayout(2, 1).earlier[0]!.scale);
		expect(trailLayout(2, 0).leaf.r).toBeGreaterThan(trailLayout(2, 1).leaf.r);
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
