/**
 * The one "Reduce effects" setting. Reduced keeps motion but drops anything that might annoy:
 * slides become fades (movement is multiplied by `effects.shift`), loops and ambient game effects
 * stop (`effects.factor`), and celebrations become a glow that fades in and holds. Durations never
 * change. CSS reads the same values as `--shift` and `--fx` (tokens.css).
 *
 * Svelte `in:`/`out:` transitions run on the Web Animations API, which CSS cannot override, so a
 * transition that moves must scale its distance by `effects.shift` in code.
 *
 * The choice is kept in localStorage under `cd-reduce-effects` ('1' or '0'). With no stored choice
 * it follows the OS reduced-motion preference. `static/effects.js` applies it before first paint;
 * keep the two in step.
 */

import { MOTION } from './tokens';

export const STORAGE_KEY = 'cd-reduce-effects';

const OS_QUERY = '(prefers-reduced-motion: reduce)';

function prefersReducedMotion(): boolean {
	return typeof matchMedia === 'function' && matchMedia(OS_QUERY).matches;
}

/** The stored choice, or the OS preference when nothing is stored or storage is blocked. */
export function readReduceEffects(): boolean {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === '1' || stored === '0') return stored === '1';
	} catch {
		// Blocked storage: fall through to the OS preference.
	}
	return prefersReducedMotion();
}

function apply(reduced: boolean): void {
	if (typeof document === 'undefined') return;
	document.documentElement.dataset.effects = reduced ? 'reduced' : 'full';
}

class Effects {
	reduced = $state(false);

	/** Multiplies every ambient effect and loop: 0.5, or 0 when reduced. */
	get factor(): number {
		return this.reduced ? MOTION.fx.reduced : MOTION.fx.full;
	}

	/** Multiplies every movement distance: 1, or 0 when reduced, so slides become fades. */
	get shift(): number {
		return this.reduced ? MOTION.shift.reduced : MOTION.shift.full;
	}

	/** Reads the setting. The root layout calls it once on mount. */
	init(): void {
		this.reduced = readReduceEffects();
		apply(this.reduced);
	}

	/** Changes and saves the setting. */
	set(reduced: boolean): void {
		this.reduced = reduced;
		apply(reduced);
		try {
			localStorage.setItem(STORAGE_KEY, reduced ? '1' : '0');
		} catch {
			// Not saved: the choice still holds until the page reloads.
		}
	}
}

export const effects = new Effects();
