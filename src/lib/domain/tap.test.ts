import { describe, expect, it } from 'vitest';
import type { TapCellQuestion } from '$lib/content/schema';
import { cellCount, cellLabel, checkTap, isCellIndexId, parseCellIndex } from './tap';

function question(patch: Partial<TapCellQuestion> = {}): TapCellQuestion {
	return {
		format: 'tap-cell',
		id: 'read-cell',
		prompt: 'Which cell does `nums[1]` read?',
		code: 'nums = [3, 0, 1, 2]',
		sequence: { kind: 'array', name: 'nums', cells: ['3', '0', '1', '2'] },
		correct: 1,
		explanation: 'Position 1 is the second cell, and it holds 0.',
		misses: [
			{ index: 0, explanation: 'Counting from 1 lands here.' },
			{ index: 2, explanation: 'The brackets do not search for a value.' },
			{ index: 3, explanation: 'This is the last cell.' }
		],
		...patch
	};
}

describe('checkTap', () => {
	it('accepts the correct index and returns its explanation', () => {
		expect(checkTap(question(), '1')).toEqual({
			correct: true,
			index: 1,
			explanation: 'Position 1 is the second cell, and it holds 0.'
		});
	});

	it('returns the explanation written for the tapped cell', () => {
		expect(checkTap(question(), '0')).toEqual({
			correct: false,
			index: 0,
			explanation: 'Counting from 1 lands here.'
		});
		expect(checkTap(question(), '2')?.explanation).toBe('The brackets do not search for a value.');
	});

	it('counts a past-the-end slot as a cell', () => {
		const withEnd = question({
			sequence: { kind: 'string', cells: ['z', 'i', 'p'], pastEnd: true },
			correct: 3,
			explanation: 'len is one past the last character.',
			misses: [
				{ index: 0, explanation: 'len is not the first index.' },
				{ index: 1, explanation: 'The middle character.' },
				{ index: 2, explanation: 'That character is inside the string.' }
			]
		});
		expect(cellCount(withEnd)).toBe(4);
		expect(checkTap(withEnd, '3')).toMatchObject({ correct: true, index: 3 });
		expect(checkTap(withEnd, '2')).toMatchObject({ correct: false, index: 2 });
		expect(checkTap(withEnd, '4')).toBeNull();
	});

	it('rejects ids that are not a cell in this sequence', () => {
		expect(checkTap(question(), '4')).toBeNull();
		expect(checkTap(question(), '01')).toBeNull();
		expect(checkTap(question(), '-1')).toBeNull();
		expect(checkTap(question(), '1.5')).toBeNull();
		expect(checkTap(question(), 'right')).toBeNull();
		expect(checkTap(question(), '')).toBeNull();
	});
});

describe('cell ids and labels', () => {
	it('accepts a plain decimal index and nothing else', () => {
		expect(isCellIndexId('0')).toBe(true);
		expect(isCellIndexId('12')).toBe(true);
		expect(isCellIndexId('01')).toBe(false);
		expect(isCellIndexId('-1')).toBe(false);
		expect(parseCellIndex('2', 2)).toBeNull();
		expect(parseCellIndex('1', 2)).toBe(1);
	});

	it('labels a value, an empty cell, and a past-the-end slot', () => {
		const sample = question();
		expect(cellLabel(sample, 1)).toBe('index 1, `0`');
		expect(cellLabel(question({ sequence: { kind: 'array', cells: [''] }, correct: 0, misses: [] }), 0)).toBe(
			'index 0, empty'
		);
		expect(
			cellLabel(
				question({ sequence: { kind: 'string', cells: ['z'], pastEnd: true } }),
				1
			)
		).toBe('index 1, past the end');
	});
});
