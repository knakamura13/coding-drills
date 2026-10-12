import {
	DEFAULT_PREFERENCES,
	THEME_COLOR,
	loadPreferences,
	resolveTheme,
	savePreferences,
	type PreferenceStore,
	type Preferences,
	type ThemeChoice
} from './preferences';

export const preferences = $state<Preferences>({ ...DEFAULT_PREFERENCES });

const FORCED_META_ID = 'theme-color-choice';

function browserStore(): PreferenceStore | null {
	try {
		if (typeof localStorage === 'undefined') return null;
		return localStorage;
	} catch {
		return null;
	}
}

function snapshot(): Preferences {
	return {
		sound: preferences.sound,
		haptics: preferences.haptics,
		immediateFeedback: preferences.immediateFeedback,
		theme: preferences.theme
	};
}

/** Applies the choice to the document. System leaves the theme-color meta tags to follow the OS. */
export function applyDocumentTheme(choice: ThemeChoice): void {
	if (typeof document === 'undefined') return;
	const resolved = resolveTheme(choice, window.matchMedia('(prefers-color-scheme: dark)').matches);
	document.documentElement.dataset.theme = resolved;
	document.documentElement.style.colorScheme = resolved;
	const existing = document.getElementById(FORCED_META_ID);
	if (choice === 'system') {
		existing?.remove();
		return;
	}
	const meta = existing instanceof HTMLMetaElement ? existing : document.createElement('meta');
	meta.id = FORCED_META_ID;
	meta.name = 'theme-color';
	meta.content = THEME_COLOR[resolved];
	if (!meta.parentElement) document.head.append(meta);
}

let listening = false;

function listenForSystemTheme(): void {
	if (listening || typeof window === 'undefined') return;
	listening = true;
	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
		if (preferences.theme === 'system') applyDocumentTheme('system');
	});
}

export function initPreferences(): void {
	const stored = loadPreferences(browserStore());
	preferences.sound = stored.sound;
	preferences.haptics = stored.haptics;
	preferences.immediateFeedback = stored.immediateFeedback;
	preferences.theme = stored.theme;
	applyDocumentTheme(preferences.theme);
	listenForSystemTheme();
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
	preferences[key] = value;
	savePreferences(browserStore(), snapshot());
	if (key === 'theme') applyDocumentTheme(preferences.theme);
}
