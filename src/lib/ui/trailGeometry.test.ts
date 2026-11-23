import { describe, expect, it } from 'vitest';
import { TREE_HEIGHT, fitLeaf, ringArcs, sampleCurve, scoreWidthEm, trailLayout } from './trailGeometry';

describe('trailLayout', () => {
	it('rises from the branch to the leaf, with the trunk starting past the left and bottom edges', () => {
		const two = trailLayout(2, 0);
		expect(two.earlier[0]!.y).toBeGreaterThan(two.earlier[1]!.y);
		expect(two.earlier[1]!.y).toBeGreaterThan(two.leaf.y);
		expect(two.edges).toHaveLength(2);
		expect(two.trunk!.from[0]).toBeLessThan(0);
		expect(two.trunk!.from[1]).toBeGreaterThan(TREE_HEIGHT);
	});

	it('runs every edge and the trunk center to center, so no node size can leave a gap', () => {
		for (const count of [0, 1, 2]) {
			for (const t of [0, 0.1, 0.5, 1]) {
				const layout = trailLayout(count, t);
				const centers = [...layout.earlier.map((node) => [node.x, node.y]), [layout.leaf.x, layout.leaf.y]];
				layout.edges.forEach((edge, index) => {
					expect(edge.from).toEqual(centers[index]);
					expect(edge.to).toEqual(centers[index + 1]);
				});
				if (layout.trunk) expect(layout.trunk.to).toEqual(centers[0]);
			}
		}
	});

	it('gives the first path one long edge from the branch to the leaf, and a lone leaf none', () => {
		const one = trailLayout(1, 0);
		expect(one.earlier).toHaveLength(1);
		expect(one.edges).toHaveLength(1);
		expect(one.trunk).not.toBeNull();
		expect(trailLayout(0, 0)).toMatchObject({ earlier: [], edges: [], trunk: null });
	});

	it('draws nodes larger on the curve than flat, and lays them on one line when flat', () => {
		expect(trailLayout(2, 0).earlier[0]!.scale).toBeGreaterThan(trailLayout(2, 1).earlier[0]!.scale);
		expect(trailLayout(2, 0).leaf.r).toBeGreaterThan(trailLayout(2, 1).leaf.r);
		const flat = trailLayout(2, 1);
		expect(new Set([...flat.earlier.map((node) => node.y), flat.leaf.y]).size).toBe(1);
	});

	it('samples a curve from end to end', () => {
		const points = sampleCurve({ from: [0, 0], control: [50, 0], to: [100, 0] });
		expect(points[0]).toEqual([0, 0]);
		expect(points.at(-1)).toEqual([100, 0]);
		expect(points.length).toBeGreaterThan(20);
	});
});

describe('ringArcs', () => {
	it('draws one arc per question, and a whole ring for one question', () => {
		expect(ringArcs(31, 8)).toHaveLength(8);
		expect(ringArcs(31, 0)).toEqual([]);
		expect(ringArcs(31, 1)[0]).toContain(' 1 1 ');
	});
});

describe('fitLeaf', () => {
	it('keeps the score at least 13px and grows the ring to hold it with room inside', () => {
		for (const scale of [0.82, 1, 1.32]) {
			for (const t of [0, 1]) {
				for (const text of ['5 of 5', '10 of 10']) {
					const { leaf } = fitLeaf(trailLayout(2, t), scale, text);
					expect(leaf.score * scale).toBeGreaterThanOrEqual(13);
					const innerPx = (leaf.r - leaf.ring) * scale;
					expect(innerPx * 2).toBeGreaterThanOrEqual(scoreWidthEm(text) * leaf.score * scale + 12 - 1e-6);
				}
			}
		}
	});
});
