/**
 * The one "Reduce effects" setting. Ambient game effects (moving motes, flowing dashes, pulsing
 * glows, rotating rings) are multiplied by `effects.factor`; durations of camera moves and other
 * motion by `effects.motion`. CSS reads the same values as `--fx` and `--motion` (theme.css).
 *
 * The choice is kept in localStorage under `cd-reduce-effects` ('1' or '0'). With no stored choice
 * it follows the OS reduced-motion preference. `static/effects.js` applies it before first paint;
 * keep the two in step.
 */

export const STORAGE_KEY = 'cd-reduce-effects';
/** Ambient effects run at this strength normally, and not at all when reduced. */
export const FX_FACTOR = 0.5;
/** Durations are multiplied by this when effects are reduced. */
export const REDUCED_MOTION = 0.4;

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

	/** Multiplies every ambient effect: 0.5, or 0 when reduced. */
	get factor(): number {
		return this.reduced ? 0 : FX_FACTOR;
	}

	/** Multiplies every motion duration: 1, or 0.4 when reduced. */
	get motion(): number {
		return this.reduced ? REDUCED_MOTION : 1;
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
