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
		depth: 'interview',
		skills: [{ kind: 'skill', id: `${id}-skill`, title: `${title} skill`, pathId: id, branchId: 'search', line: 'main', after: [], depth: 'interview' }],
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
		depth: 'interview' as const,
		note: 'Noted.'
	})),
	followUps: []
};

function attempt(id: string, correct: boolean): Attempt {
	return { id, at: '2026-01-01T12:00:00.000Z', day: '2026-01-01', deckId: `${id}-deck`, questionId: `${id}-q`, pickedId: 'x', correct };
}

describe('lessonTrail', () => {
	it('leads from the branch to the first lesson on it', () => {
		expect(lessonTrail(curriculum, [], 'exact-deck', 'Exact search deck', 'deep')).toEqual({
			earlier: [{ kind: 'branch', id: 'search', title: 'Sequences and search', mastered: false }],
			title: 'Exact search'
		});
	});

	it('shows at most two earlier nodes, dropping the branch once two lessons precede', () => {
		expect(lessonTrail(curriculum, [], 'boundary-deck', '', 'deep').earlier.map((node) => node.title)).toEqual(['Sequences and search', 'Exact search']);
		expect(lessonTrail(curriculum, [], 'rotated-deck', '', 'deep').earlier.map((node) => node.title)).toEqual(['Exact search', 'Boundary search']);
	});

	it('marks an earlier lesson mastered only while its skills are', () => {
		const mastered = lessonTrail(curriculum, [attempt('exact', true)], 'boundary-deck', '', 'deep').earlier[1];
		expect(mastered).toMatchObject({ id: 'exact', mastered: true });
		const slipped = lessonTrail(curriculum, [attempt('exact', false)], 'boundary-deck', '', 'deep').earlier[1];
		expect(slipped).toMatchObject({ id: 'exact', mastered: false });
	});

	it('is no one path for a deck that mixes paths: its branch, then the deck', () => {
		const mixed: Curriculum = {
			...curriculum,
			drills: [...curriculum.drills, { ...curriculum.drills[0]!, questionId: 'mixed-1', deckId: 'mixed-deck' }, { ...curriculum.drills[2]!, questionId: 'mixed-2', deckId: 'mixed-deck' }]
		};
		expect(lessonTrail(mixed, [], 'mixed-deck', 'Searching', 'deep')).toEqual({
			earlier: [{ kind: 'branch', id: 'search', title: 'Sequences and search', mastered: false }],
			title: 'Searching'
		});
	});

	it('leaves out paths and drills the level hides', () => {
		const deeper: Curriculum = {
			...curriculum,
			branches: [{ ...curriculum.branches[0]!, paths: [path('exact', 'Exact search'), { ...path('fallback', 'Search with fallbacks'), depth: 'deep' }, path('boundary', 'Boundary search')] }],
			drills: [
				...curriculum.drills,
				{ questionId: 'fallback-q', deckId: 'fallback-deck', disposition: 'keep', pathId: 'fallback', skillId: 'fallback-skill', covers: [], depth: 'deep', note: 'Noted.' },
				{ questionId: 'boundary-deep-q', deckId: 'exact-deck', disposition: 'keep', pathId: 'boundary', skillId: 'boundary-skill', covers: [], depth: 'deep', note: 'Noted.' }
			]
		};
		expect(lessonTrail(deeper, [], 'boundary-deck', '', 'deep').earlier.map((node) => node.title)).toEqual(['Exact search', 'Search with fallbacks']);
		expect(lessonTrail(deeper, [], 'boundary-deck', '', 'interview').earlier.map((node) => node.title)).toEqual(['Sequences and search', 'Exact search']);
		// At Deep exact-deck holds a Boundary search drill too, so it is no one path; at Interview it is Exact search.
		expect(lessonTrail(deeper, [], 'exact-deck', 'Exact deck', 'deep').title).toBe('Exact deck');
		expect(lessonTrail(deeper, [], 'exact-deck', 'Exact deck', 'interview').title).toBe('Exact search');
	});

	it('is just the deck for a deck no path maps', () => {
		expect(lessonTrail(curriculum, [], 'loose-deck', 'Loose deck', 'deep')).toEqual({ earlier: [], title: 'Loose deck' });
	});
});
