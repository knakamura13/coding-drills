import { describe, expect, it } from 'vitest';
import { sequenceModel } from './board';

describe('sequenceModel', () => {
	it('numbers every cell and keeps values in order', () => {
		const model = sequenceModel({ presentation: 'array', name: 'nums', values: ['3', '0', '1'] });
		expect(model.kind).toBe('sequence');
		expect(model.presentation).toBe('array');
		expect(model.name).toBe('nums');
		expect(model.cells.map((cell) => [cell.id, cell.index, cell.value, cell.pastEnd])).toEqual([
			['0', 0, '3', false],
			['1', 1, '0', false],
			['2', 2, '1', false]
		]);
	});

	it('adds one empty cell past the end and leaves markers off it unless asked', () => {
		const model = sequenceModel({
			presentation: 'string',
			values: ['z', 'i', 'p'],
			pastEnd: true,
			markers: [
				{ name: 'i', at: 2 },
				{ name: 'left', at: 0 }
			]
		});
		expect(model.cells).toHaveLength(4);
		expect(model.cells[3]).toMatchObject({ id: '3', index: 3, value: '', pastEnd: true, markers: [] });
		expect(model.cells[0].markers).toEqual(['left']);
		expect(model.cells[2].markers).toEqual(['i']);
	});

	it('keeps two markers on one cell in author order', () => {
		const model = sequenceModel({
			presentation: 'array',
			values: ['8', '1'],
			markers: [
				{ name: 'left', at: 1 },
				{ name: 'right', at: 1 }
			]
		});
		expect(model.cells[1].markers).toEqual(['left', 'right']);
		expect(model.cells[0].markers).toEqual([]);
	});

	it('drops a marker whose index is not a cell', () => {
		const model = sequenceModel({
			presentation: 'array',
			values: ['1'],
			markers: [{ name: 'i', at: 4 }]
		});
		expect(model.cells.every((cell) => cell.markers.length === 0)).toBe(true);
	});
});
