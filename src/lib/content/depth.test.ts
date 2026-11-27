import { describe, expect, it } from 'vitest';
import type { Curriculum, CurriculumDrill } from './curriculum.ts';
import { DEFAULT_DEPTH, DEPTHS, depthMap, visibleAt } from './depth.ts';

describe('visibleAt', () => {
	it('shows an item at or below the level, in the order DEPTHS lists', () => {
		DEPTHS.forEach((item, i) => {
			DEPTHS.forEach((level, j) => expect(visibleAt(item, level), `${item} at ${level}`).toBe(i <= j));
		});
	});

	it('shows interview items at deep and hides deep items at interview', () => {
		expect(visibleAt('interview', 'deep')).toBe(true);
		expect(visibleAt('deep', 'interview')).toBe(false);
		expect(DEFAULT_DEPTH).toBe(DEPTHS[0]);
	});
});

describe('depthMap', () => {
	it('maps only the drills deeper than the default depth', () => {
		const drill = (questionId: string, depth: CurriculumDrill['depth']): CurriculumDrill => ({
			questionId,
			deckId: 'deck',
			disposition: 'keep',
			pathId: 'path',
			covers: [],
			depth,
			note: 'Mapped.'
		});
		const curriculum: Curriculum = { branches: [], drills: [drill('one', 'interview'), drill('two', 'deep')], followUps: [] };
		expect(depthMap(curriculum)).toEqual({ two: 'deep' });
	});
});
