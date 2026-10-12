import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	DEFAULT_PREFERENCES,
	PREFERENCES_KEY,
	THEME_COLOR,
	loadPreferences,
	readPreferences,
	resolveTheme,
	savePreferences,
	type PreferenceStore
} from './preferences';

function memoryStore(initial?: string): PreferenceStore & { raw: string | null } {
	const box = { raw: initial ?? null };
	return {
		get raw() {
			return box.raw;
		},
		set raw(value: string | null) {
			box.raw = value;
		},
		getItem() {
			return box.raw;
		},
		setItem(_key: string, value: string) {
			box.raw = value;
		}
	};
}

describe('readPreferences', () => {
	it('uses the defaults when nothing is stored', () => {
		expect(readPreferences(null)).toEqual(DEFAULT_PREFERENCES);
		expect(DEFAULT_PREFERENCES).toEqual({
			sound: false,
			haptics: false,
			immediateFeedback: false,
			theme: 'system'
		});
	});

	it('keeps valid fields and drops the rest', () => {
		expect(
			readPreferences(
				JSON.stringify({ sound: true, haptics: 'yes', immediateFeedback: true, theme: 'dark', extra: 1 })
			)
		).toEqual({
			sound: true,
			haptics: false,
			immediateFeedback: true,
			theme: 'dark'
		});
	});

	it('falls back when the stored value is not preferences', () => {
		expect(readPreferences('not json')).toEqual(DEFAULT_PREFERENCES);
		expect(readPreferences('[]')).toEqual(DEFAULT_PREFERENCES);
		expect(readPreferences(JSON.stringify({ theme: 'sepia' }))).toEqual(DEFAULT_PREFERENCES);
	});
});

describe('loadPreferences and savePreferences', () => {
	it('round-trips through a store', () => {
		const store = memoryStore();
		const saved = { sound: true, haptics: true, immediateFeedback: true, theme: 'light' as const };
		savePreferences(store, saved);
		expect(store.getItem(PREFERENCES_KEY)).toContain('"theme":"light"');
		expect(loadPreferences(store)).toEqual(saved);
	});

	it('returns defaults when the store is missing or throws', () => {
		expect(loadPreferences(null)).toEqual(DEFAULT_PREFERENCES);
		const broken: PreferenceStore = {
			getItem() {
				throw new Error('blocked');
			},
			setItem() {
				throw new Error('blocked');
			}
		};
		expect(loadPreferences(broken)).toEqual(DEFAULT_PREFERENCES);
		expect(() => savePreferences(broken, DEFAULT_PREFERENCES)).not.toThrow();
	});
});

describe('resolveTheme', () => {
	it('follows the system only for the system choice', () => {
		expect(resolveTheme('system', true)).toBe('dark');
		expect(resolveTheme('system', false)).toBe('light');
		expect(resolveTheme('light', true)).toBe('light');
		expect(resolveTheme('dark', false)).toBe('dark');
	});
});

describe('theme colors', () => {
	it('publishes a light and a dark theme color in the page and the manifest', () => {
		const html = readFileSync('src/app.html', 'utf8');
		const manifest = readFileSync('static/manifest.webmanifest', 'utf8');
		const boot = readFileSync('static/theme.js', 'utf8');
		for (const color of Object.values(THEME_COLOR)) {
			expect(html).toContain(color);
			expect(manifest).toContain(color);
			expect(boot).toContain(color);
		}
		expect(html).toContain('(prefers-color-scheme: light)');
		expect(html).toContain('(prefers-color-scheme: dark)');
		expect(manifest).toContain('color_scheme_dark');
	});
});
