import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LEVEL } from '$lib/content/depth';
import { PREFERENCES_KEY } from './preferences';

function memoryStorage() {
	const items = new Map<string, string>();
	return {
		getItem: (key: string) => items.get(key) ?? null,
		setItem: (key: string, value: string) => void items.set(key, value)
	};
}

// The store keeps module state, so each test loads a fresh copy. `document` and `window` stay
// undefined, which skips the theme work.
async function freshStore() {
	vi.resetModules();
	return import('./store.svelte');
}

describe('learnerDepth and the saved level', () => {
	let storage: ReturnType<typeof memoryStorage>;
	beforeEach(() => {
		storage = memoryStorage();
		vi.stubGlobal('localStorage', storage);
	});
	afterEach(() => vi.unstubAllGlobals());

	it('is the default level with nothing stored, and during prerendering', async () => {
		const { learnerDepth } = await freshStore();
		expect(learnerDepth()).toBe(DEFAULT_LEVEL);
		vi.stubGlobal('localStorage', undefined);
		expect(learnerDepth()).toBe(DEFAULT_LEVEL);
	});

	it('reads the stored level on every call, without waiting for initPreferences', async () => {
		const { learnerDepth } = await freshStore();
		storage.setItem(PREFERENCES_KEY, JSON.stringify({ depth: 'interview' }));
		expect(learnerDepth()).toBe('interview');
		storage.setItem(PREFERENCES_KEY, JSON.stringify({ depth: 'nonsense' }));
		expect(learnerDepth()).toBe(DEFAULT_LEVEL);
	});

	it('does not write a level when another preference is saved', async () => {
		const { initPreferences, setPreference } = await freshStore();
		initPreferences();
		setPreference('sound', true);
		expect(JSON.parse(storage.getItem(PREFERENCES_KEY)!)).not.toHaveProperty('depth');
	});

	it('keeps a level stored after the page loaded when another preference is saved', async () => {
		const { initPreferences, learnerDepth, setPreference } = await freshStore();
		initPreferences();
		storage.setItem(PREFERENCES_KEY, JSON.stringify({ depth: 'interview' }));
		setPreference('haptics', true);
		expect(JSON.parse(storage.getItem(PREFERENCES_KEY)!)).toEqual(expect.objectContaining({ haptics: true, depth: 'interview' }));
		expect(learnerDepth()).toBe('interview');
	});
});
