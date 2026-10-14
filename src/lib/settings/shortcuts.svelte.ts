/**
 * Single-key shortcuts: the number keys choose an answer in a lesson, and "/"
 * moves to the filter on the decks page. A shortcut that uses a single
 * character must be switchable off (WCAG 2.1.4), so the menu has a toggle.
 *
 * This is a per-browser preference, so it lives in localStorage. Storage can be
 * blocked, in which case the default (on) applies for the visit.
 */

const KEY = 'coding-drills:v1:single-key-shortcuts';

export const shortcuts = $state({ enabled: true });

/** Reads the saved choice. Call once on mount, since storage is not available while prerendering. */
export function loadShortcuts(): void {
	try {
		shortcuts.enabled = localStorage.getItem(KEY) !== 'off';
	} catch {
		// Blocked storage: keep the default.
	}
}

export function setShortcuts(enabled: boolean): void {
	shortcuts.enabled = enabled;
	try {
		localStorage.setItem(KEY, enabled ? 'on' : 'off');
	} catch {
		// Not remembered, but the choice still applies for this visit.
	}
}
