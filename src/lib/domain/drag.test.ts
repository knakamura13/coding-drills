import { describe, expect, it } from 'vitest';
import type { DragPointersQuestion } from '$lib/content/schema';
import { checkPlacement, correctPlacement, movePointer, parsePlacement, placementLabel, placementPickId, startPlacement } from './drag';

function question(): DragPointersQuestion {
	return {
		format: 'drag-pointers',
		id: 'move-ends',
		prompt: 'Where do `l` and `r` sit after one step?',
		code: 'l += 1',
		sequence: { kind: 'array', name: 'nums', cells: ['1', '4', '6', '8', '11'] },
		pointers: [
			{
				name: 'l',
				start: 0,
				correct: 1,
				explanation: 'The sum is too small, so l moves right.',
				misses: [{ index: 2, explanation: 'One step moves l a single cell.' }],
				elsewhere: 'l moves exactly one cell.'
			},
			{
				name: 'r',
				start: 4,
				correct: 4,
				explanation: 'r stays.',
				elsewhere: 'r does not move when the sum is too small.'
			}
		]
	};
}

describe('placements', () => {
	it('starts every pointer on its start cell and round-trips through a pick id', () => {
		const q = question();
		expect(startPlacement(q)).toEqual({ l: 0, r: 4 });
		expect(placementPickId(q, startPlacement(q))).toBe('l=0,r=4');
		expect(parsePlacement(q, 'l=1,r=4')).toEqual({ l: 1, r: 4 });
	});

	it('rejects a pick that is not exactly this question\'s pointers, in order, on real cells', () => {
		const q = question();
		for (const bad of ['', 'l=1', 'r=4,l=1', 'l=1,r=5', 'l=01,r=4', 'l=-1,r=4', 'x=1,r=4', 'l=1,r=4,r=4', 'l=a,r=4']) {
			expect(parsePlacement(q, bad), bad).toBeNull();
		}
	});

	it('counts a past-the-end slot as a cell a pointer can reach', () => {
		const q = { ...question(), sequence: { kind: 'array' as const, cells: ['1', '4'], pastEnd: true } };
		expect(parsePlacement({ ...q, pointers: [{ ...q.pointers[0]!, start: 0, correct: 2 }] }, 'l=2')).toEqual({ l: 2 });
		expect(parsePlacement({ ...q, pointers: [{ ...q.pointers[0]!, start: 0, correct: 2 }] }, 'l=3')).toBeNull();
	});

	it('moves one pointer and leaves the others, starting from the start when nothing is picked yet', () => {
		const q = question();
		expect(movePointer(q, null, 'l', 3)).toBe('l=3,r=4');
		expect(movePointer(q, 'l=3,r=4', 'r', 2)).toBe('l=3,r=2');
		expect(movePointer(q, null, 'l', 5)).toBeNull();
		expect(movePointer(q, null, 'x', 1)).toBeNull();
	});
});

describe('checkPlacement', () => {
	it('is correct only when every pointer is on its cell, and explains each', () => {
		const result = checkPlacement(question(), 'l=1,r=4')!;
		expect(result.correct).toBe(true);
		expect(result.pointers.map((pointer) => pointer.correct)).toEqual([true, true]);
		expect(result.explanation).toBe('`l`: The sum is too small, so l moves right.\n\n`r`: r stays.');
	});

	it('explains only the wrong pointers, using the targeted miss when there is one', () => {
		const q = question();
		expect(checkPlacement(q, 'l=2,r=4')).toMatchObject({
			correct: false,
			explanation: '`l`: One step moves l a single cell.'
		});
		const both = checkPlacement(q, 'l=3,r=2')!;
		expect(both.correct).toBe(false);
		expect(both.explanation).toBe('`l`: l moves exactly one cell.\n\n`r`: r does not move when the sum is too small.');
	});

	it('treats a pointer that was never moved as sitting on its start', () => {
		expect(checkPlacement(question(), 'l=0,r=4')).toMatchObject({ correct: false, explanation: '`l`: l moves exactly one cell.' });
	});

	it('is null for a malformed pick', () => {
		expect(checkPlacement(question(), 'l=1')).toBeNull();
	});

	it('labels placements as inline code', () => {
		const q = question();
		expect(placementLabel(q, correctPlacement(q))).toBe('`l` at 1, `r` at 4');
	});
});
