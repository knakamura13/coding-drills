import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { effects, readReduceEffects, STORAGE_KEY } from './effects.svelte';

/** A fake OS reduced-motion query whose setting can change while the page is open. */
function osSetting(matches: boolean) {
	const listeners = new Set<(event: { matches: boolean }) => void>();
	return {
		matches,
		addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => listeners.add(listener),
		removeEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => listeners.delete(listener),
		change(next: boolean) {
			this.matches = next;
			for (const listener of listeners) listener({ matches: next });
		}
	};
}

const matchMedia = vi.fn();
let os: ReturnType<typeof osSetting>;
let stored: Map<string, string>;
let dataset: Record<string, string>;

function setOs(matches: boolean) {
	os = osSetting(matches);
	matchMedia.mockReturnValue(os);
}

beforeEach(() => {
	stored = new Map();
	dataset = {};
	matchMedia.mockReset();
	setOs(false);
	vi.stubGlobal('matchMedia', matchMedia);
	vi.stubGlobal('document', { documentElement: { dataset } });
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => stored.get(key) ?? null,
		setItem: (key: string, value: string) => stored.set(key, value)
	});
});

afterEach(() => vi.unstubAllGlobals());

describe('Reduce effects', () => {
	it.each([true, false])('follows the OS default when reduced motion is %s, leaving CSS to the media query', (reduced) => {
		setOs(reduced);
		effects.init();

		expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
		expect(effects.reduced).toBe(reduced);
		expect(effects.factor).toBe(reduced ? 0 : 0.5);
		expect(effects.shift).toBe(reduced ? 0 : 1);
		expect(dataset.effects).toBeUndefined();
		expect(stored.size).toBe(0);
	});

	it('keeps following the OS when it changes while the page is open and nothing is saved', () => {
		setOs(false);
		effects.init();
		os.change(true);
		expect(effects.reduced).toBe(true);
		os.change(false);
		expect(effects.reduced).toBe(false);
		expect(dataset.effects).toBeUndefined();
	});

	it('ignores OS changes once a choice is saved', () => {
		setOs(false);
		effects.init();
		effects.set(false);
		os.change(true);
		expect(effects.reduced).toBe(false);
		expect(dataset.effects).toBe('full');
	});

	it.each([true, false])('persists and restores a %s override against the OS default', async (reduced) => {
		setOs(!reduced);
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
		setOs(true);
		effects.init();
		expect(effects.reduced).toBe(true);
		expect(dataset.effects).toBeUndefined();

		effects.set(false);
		expect(effects.reduced).toBe(false);
		expect(dataset.effects).toBe('full');
	});

	// static/effects.js marks a saved choice before the app loads, so the first frame never
	// animates at full strength. What CSS then shows (the mark, or the OS with no mark) must match
	// the store for every saved value and OS setting.
	it.each([
		{ value: null, reduceOs: false },
		{ value: null, reduceOs: true },
		{ value: '1', reduceOs: false },
		{ value: '0', reduceOs: true },
		{ value: 'junk', reduceOs: true },
		{ value: 'blocked', reduceOs: true }
	])('marks the same choice before first paint (saved $value, OS reduced $reduceOs)', ({ value, reduceOs }) => {
		setOs(reduceOs);
		if (value === 'blocked') {
			vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); } });
		} else if (value !== null) {
			stored.set(STORAGE_KEY, value);
		}
		new Function(readFileSync('static/effects.js', 'utf8'))();

		const saved = value === '1' || value === '0';
		expect(dataset.effects).toBe(saved ? (value === '1' ? 'reduced' : 'full') : undefined);
		const shown = dataset.effects ? dataset.effects === 'reduced' : reduceOs;
		expect(shown).toBe(readReduceEffects());
	});

	it('loads the pre-paint script from the page head', () => {
		const html = readFileSync('src/app.html', 'utf8');
		const head = html.slice(0, html.indexOf('</head>'));
		expect(head).toContain('<script src="%sveltekit.assets%/effects.js"></script>');
		expect(head.indexOf('effects.js')).toBeLessThan(head.indexOf('%sveltekit.head%'));
	});

	it('defaults to full effects outside the browser', () => {
		vi.stubGlobal('matchMedia', undefined);
		vi.stubGlobal('document', undefined);
		vi.stubGlobal('localStorage', undefined);
		effects.init();

		expect(effects.reduced).toBe(false);
	});
});
