import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effects, STORAGE_KEY } from './effects.svelte';

const matchMedia = vi.fn();
let stored: Map<string, string>;
let dataset: Record<string, string>;

beforeEach(() => {
	stored = new Map();
	dataset = {};
	matchMedia.mockReset();
	matchMedia.mockReturnValue({ matches: false });
	vi.stubGlobal('matchMedia', matchMedia);
	vi.stubGlobal('document', { documentElement: { dataset } });
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => stored.get(key) ?? null,
		setItem: (key: string, value: string) => stored.set(key, value)
	});
});

afterEach(() => vi.unstubAllGlobals());

describe('Reduce effects', () => {
	it.each([true, false])('follows the OS default when reduced motion is %s', (reduced) => {
		matchMedia.mockReturnValue({ matches: reduced });
		effects.init();

		expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
		expect(effects.reduced).toBe(reduced);
		expect(effects.factor).toBe(reduced ? 0 : 0.5);
		expect(effects.motion).toBe(reduced ? 0.4 : 1);
		expect(dataset.effects).toBe(reduced ? 'reduced' : 'full');
		expect(stored.size).toBe(0);
	});

	it.each([true, false])('persists and restores a %s override against the OS default', async (reduced) => {
		matchMedia.mockReturnValue({ matches: !reduced });
		effects.init();
		effects.set(reduced);
		expect(effects.reduced).toBe(reduced);
		expect(stored.get(STORAGE_KEY)).toBe(reduced ? '1' : '0');

		vi.resetModules();
		const { effects: reloaded } = await import('./effects.svelte');
		delete dataset.effects;
		reloaded.init();
		expect(reloaded.reduced).toBe(reduced);
		expect(dataset.effects).toBe(reduced ? 'reduced' : 'full');
	});

	it('follows the OS when storage is blocked and applies changes for the current page', () => {
		vi.stubGlobal('localStorage', {
			getItem: () => { throw new Error('blocked'); },
			setItem: () => { throw new Error('blocked'); }
		});
		matchMedia.mockReturnValue({ matches: true });
		effects.init();
		expect(effects.reduced).toBe(true);

		effects.set(false);
		expect(effects.reduced).toBe(false);
		expect(dataset.effects).toBe('full');
	});

	it('defaults to full effects outside the browser', () => {
		vi.stubGlobal('matchMedia', undefined);
		vi.stubGlobal('document', undefined);
		vi.stubGlobal('localStorage', undefined);
		effects.init();

		expect(effects.reduced).toBe(false);
	});
});
