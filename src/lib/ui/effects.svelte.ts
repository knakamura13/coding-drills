/**
 * The one "Reduce effects" setting. Reduced keeps motion but drops anything that might annoy:
 * slides become fades (movement is multiplied by `effects.shift`), loops and ambient game effects
 * stop (`effects.factor`), and celebrations become a glow that fades in and holds. Durations never
 * change. CSS reads the same values as `--shift` and `--fx` (tokens.css).
 *
 * Svelte `in:`/`out:` transitions run on the Web Animations API, which CSS cannot override, so a
 * transition that moves must scale its distance by `effects.shift` in code.
 *
 * A saved choice is kept in localStorage under `facet:v1:reduce-effects` ('1' or '0') and marked on
 * <html> as `data-effects`. With no saved choice there is no attribute: tokens.css then follows the
 * OS reduced-motion setting through its media query, live, and this store follows the same setting
 * through a change listener. `static/effects.js` marks a saved choice before first paint; keep the
 * two in step.
 */

import { MOTION } from './tokens';

export const STORAGE_KEY = 'facet:v1:reduce-effects';

const OS_QUERY = '(prefers-reduced-motion: reduce)';

function osQuery(): MediaQueryList | null {
	return typeof matchMedia === 'function' ? matchMedia(OS_QUERY) : null;
}

/** The saved choice, or null when nothing is saved or storage is blocked. */
export function readSavedChoice(): boolean | null {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === '1' || stored === '0') return stored === '1';
	} catch {
		// Blocked storage: no saved choice.
	}
	return null;
}

/** Whether effects are reduced now: the saved choice, else the OS preference. */
export function readReduceEffects(): boolean {
	return readSavedChoice() ?? osQuery()?.matches ?? false;
}

/** Marks a saved choice on <html>; with none, removes the mark so CSS follows the OS. */
function mark(choice: boolean | null): void {
	if (typeof document === 'undefined') return;
	const { dataset } = document.documentElement;
	if (choice === null) delete dataset.effects;
	else dataset.effects = choice ? 'reduced' : 'full';
}

class Effects {
	reduced = $state(false);

	#query: MediaQueryList | null = null;

	/** With no saved choice, an OS change applies at once, as it does in CSS. */
	#onOsChange = (event: MediaQueryListEvent) => {
		if (readSavedChoice() === null) this.reduced = event.matches;
	};

	/** Multiplies every ambient effect and loop: 0.5, or 0 when reduced. */
	get factor(): number {
		return this.reduced ? MOTION.fx.reduced : MOTION.fx.full;
	}

	/** Multiplies every movement distance: 1, or 0 when reduced, so slides become fades. */
	get shift(): number {
		return this.reduced ? MOTION.shift.reduced : MOTION.shift.full;
	}

	/** Reads the setting and starts following the OS. The root layout calls it once on mount. */
	init(): void {
		const choice = readSavedChoice();
		const query = osQuery();
		this.reduced = choice ?? query?.matches ?? false;
		mark(choice);
		this.#query?.removeEventListener?.('change', this.#onOsChange);
		this.#query = query;
		query?.addEventListener?.('change', this.#onOsChange);
	}

	/** Changes and saves the setting. From then on the OS setting no longer applies. */
	set(reduced: boolean): void {
		this.reduced = reduced;
		mark(reduced);
		try {
			localStorage.setItem(STORAGE_KEY, reduced ? '1' : '0');
		} catch {
			// Not saved: the choice still holds until the page reloads.
		}
	}
}

export const effects = new Effects();
