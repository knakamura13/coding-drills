import { afterEach, describe, expect, it, vi } from 'vitest';
import { depths } from 'virtual:depths';
import { PREFERENCES_KEY } from '$lib/preferences/preferences';
import { deck } from '$lib/testing/fixtures';
import { decksAtLearnerLevel } from './level';

// A real deep question id, so the helper is checked against the shipped depth map.
const deepId = Object.keys(depths)[0]!;
const decks = [deck('mixed', [{ id: 'plain' }, { id: deepId }]), deck('deep-only', [{ id: deepId }])];

function storeLevel(value: string | null) {
	const items = new Map<string, string>(value === null ? [] : [[PREFERENCES_KEY, value]]);
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => items.get(key) ?? null,
		setItem: (key: string, next: string) => void items.set(key, next),
		removeItem: (key: string) => void items.delete(key)
	});
}

afterEach(() => vi.unstubAllGlobals());

describe('decksAtLearnerLevel', () => {
	it('keeps every deck with no level saved (the default is Deep)', () => {
		storeLevel(null);
		expect(decksAtLearnerLevel(decks).map((item) => item.questions.length)).toEqual([2, 1]);
	});

	it('reads the saved level on each call, dropping deeper questions and decks left empty', () => {
		storeLevel(JSON.stringify({ depth: 'interview' }));
		const shown = decksAtLearnerLevel(decks);
		expect(shown.map((item) => item.id)).toEqual(['mixed']);
		expect(shown[0]!.questions.map((question) => question.id)).toEqual(['plain']);
		storeLevel(JSON.stringify({ depth: 'deep' }));
		expect(decksAtLearnerLevel(decks)).toHaveLength(2);
	});

	it('returns the same array for the same decks and level, so derived views do not rebuild', () => {
		storeLevel(JSON.stringify({ depth: 'interview' }));
		expect(decksAtLearnerLevel(decks)).toBe(decksAtLearnerLevel(decks));
		expect(decksAtLearnerLevel(decks, 'deep')).not.toBe(decksAtLearnerLevel(decks, 'interview'));
	});
});
