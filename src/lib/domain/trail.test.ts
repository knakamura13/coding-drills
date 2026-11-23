import { describe, expect, it } from 'vitest';
import type { Curriculum, CurriculumPath } from '$lib/content/curriculum';
import type { Attempt } from '$lib/storage/types';
import { lessonTrail } from './trail';

function path(id: string, title: string): CurriculumPath {
	return {
		id,
		title,
		summary: `${title}.`,
		branchId: 'search',
		after: [],
		skills: [{ kind: 'skill', id: `${id}-skill`, title: `${title} skill`, pathId: id, branchId: 'search', line: 'main', after: [] }],
		forks: [],
		checkpoints: []
	};
}

const curriculum: Curriculum = {
	branches: [
		{
			id: 'search',
			title: 'Sequences and search',
			summary: 'Search.',
			order: 1,
			paths: [path('exact', 'Exact search'), path('boundary', 'Boundary search'), path('rotated', 'Rotated search')]
		}
	],
	drills: ['exact', 'boundary', 'rotated'].map((id) => ({
		questionId: `${id}-q`,
		deckId: `${id}-deck`,
		disposition: 'keep' as const,
		pathId: id,
		skillId: `${id}-skill`,
		covers: [],
		note: 'Noted.'
	})),
	followUps: []
};

function attempt(id: string, correct: boolean): Attempt {
	return { id, at: '2026-01-01T12:00:00.000Z', day: '2026-01-01', deckId: `${id}-deck`, questionId: `${id}-q`, pickedId: 'x', correct };
}

describe('lessonTrail', () => {
	it('leads from the branch to the first lesson on it', () => {
		expect(lessonTrail(curriculum, [], 'exact-deck', 'Exact search deck')).toEqual({
			earlier: [{ kind: 'branch', id: 'search', title: 'Sequences and search', mastered: false }],
			title: 'Exact search'
		});
	});

	it('shows at most two earlier nodes, dropping the branch once two lessons precede', () => {
		expect(lessonTrail(curriculum, [], 'boundary-deck', '').earlier.map((node) => node.title)).toEqual(['Sequences and search', 'Exact search']);
		expect(lessonTrail(curriculum, [], 'rotated-deck', '').earlier.map((node) => node.title)).toEqual(['Exact search', 'Boundary search']);
	});

	it('marks an earlier lesson mastered only while its skills are', () => {
		const mastered = lessonTrail(curriculum, [attempt('exact', true)], 'boundary-deck', '').earlier[1];
		expect(mastered).toMatchObject({ id: 'exact', mastered: true });
		const slipped = lessonTrail(curriculum, [attempt('exact', false)], 'boundary-deck', '').earlier[1];
		expect(slipped).toMatchObject({ id: 'exact', mastered: false });
	});

	it('is just the deck for a deck no path maps', () => {
		expect(lessonTrail(curriculum, [], 'loose-deck', 'Loose deck')).toEqual({ earlier: [], title: 'Loose deck' });
	});
});
