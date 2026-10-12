/**
 * Device-local preferences. Appearance can differ per device, so this stays
 * out of the synced attempt and flag log.
 */

export const PREFERENCES_KEY = 'coding-drills:v1:preferences';

export const THEME_COLOR = {
	light: '#f6f7fb',
	dark: '#1c1c25'
} as const;

export type ThemeChoice = 'system' | 'light' | 'dark';
export type ResolvedTheme = keyof typeof THEME_COLOR;

export const THEME_CHOICES = [
	{ id: 'system', label: 'System' },
	{ id: 'light', label: 'Light' },
	{ id: 'dark', label: 'Dark' }
] as const satisfies readonly { id: ThemeChoice; label: string }[];

export interface Preferences {
	sound: boolean;
	haptics: boolean;
	/** Default off. When on, picking an option checks it immediately. */
	immediateFeedback: boolean;
	theme: ThemeChoice;
}

export const DEFAULT_PREFERENCES: Preferences = {
	sound: false,
	haptics: false,
	immediateFeedback: false,
	theme: 'system'
};

export interface PreferenceStore {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

const THEME_IDS = new Set<string>(THEME_CHOICES.map((choice) => choice.id));

function isThemeChoice(value: unknown): value is ThemeChoice {
	return typeof value === 'string' && THEME_IDS.has(value);
}

export function readPreferences(raw: string | null): Preferences {
	if (!raw) return { ...DEFAULT_PREFERENCES };
	try {
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_PREFERENCES };
		const record = parsed as Partial<Record<keyof Preferences, unknown>>;
		return {
			sound: typeof record.sound === 'boolean' ? record.sound : DEFAULT_PREFERENCES.sound,
			haptics: typeof record.haptics === 'boolean' ? record.haptics : DEFAULT_PREFERENCES.haptics,
			immediateFeedback:
				typeof record.immediateFeedback === 'boolean'
					? record.immediateFeedback
					: DEFAULT_PREFERENCES.immediateFeedback,
			theme: isThemeChoice(record.theme) ? record.theme : DEFAULT_PREFERENCES.theme
		};
	} catch {
		return { ...DEFAULT_PREFERENCES };
	}
}

export function loadPreferences(store: PreferenceStore | null): Preferences {
	if (!store) return { ...DEFAULT_PREFERENCES };
	try {
		return readPreferences(store.getItem(PREFERENCES_KEY));
	} catch {
		return { ...DEFAULT_PREFERENCES };
	}
}

export function savePreferences(store: PreferenceStore | null, preferences: Preferences): void {
	if (!store) return;
	try {
		store.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
	} catch {
		// A private window can reject the write. The choice still applies for this visit.
	}
}

export function resolveTheme(choice: ThemeChoice, systemDark: boolean): ResolvedTheme {
	switch (choice) {
		case 'system':
			return systemDark ? 'dark' : 'light';
		case 'light':
			return 'light';
		case 'dark':
			return 'dark';
		default: {
			const never: never = choice;
			return never;
		}
	}
}
