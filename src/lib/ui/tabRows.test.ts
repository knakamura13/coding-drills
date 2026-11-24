import { describe, expect, it } from 'vitest';
import { stackRows } from './tabRows';

describe('stackRows', () => {
	it('keeps tabs apart in one row when they clear each other', () => {
		expect(stackRows([{ center: 22, width: 40 }, { center: 110, width: 40 }])).toEqual([0, 0]);
	});

	it('stacks two pointers on one cell', () => {
		expect(stackRows([{ center: 66, width: 40 }, { center: 66, width: 40 }])).toEqual([0, 1]);
	});

	it('stacks long names on neighboring cells, and returns rows in input order', () => {
		// "second" on cell 1 and "first" on cell 0 overlap at 44px apart.
		expect(stackRows([{ center: 66, width: 70 }, { center: 22, width: 56 }])).toEqual([1, 0]);
	});

	it('reuses the lowest row that clears', () => {
		expect(stackRows([{ center: 22, width: 40 }, { center: 22, width: 40 }, { center: 200, width: 40 }])).toEqual([0, 1, 0]);
	});
});
