/**
 * Motion for the new screens (lesson Round 7), in script where CSS alone cannot do it. The curve and
 * durations are the motion tokens; Reduce effects is read from the same `--shift` the CSS uses, so
 * script and style never disagree: 1 with full effects, 0 when reduced (slides become fades).
 */
import { MOTION } from './tokens';

/** `cubic-bezier(x1, y1, x2, y2)` as a function of progress 0..1. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
	const curve = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s ** 2 * (1 - s) + s ** 3;
	return (t) => {
		if (t <= 0) return 0;
		if (t >= 1) return 1;
		// Find s where x(s) = t by bisection: exact enough for an animation, and never diverges.
		let low = 0;
		let high = 1;
		for (let step = 0; step < 24; step++) {
			const mid = (low + high) / 2;
			if (curve(x1, x2, mid) < t) low = mid;
			else high = mid;
		}
		return curve(y1, y2, (low + high) / 2);
	};
}

const [x1, y1, x2, y2] = MOTION.ease.match(/[\d.]+/g)!.map(Number) as [number, number, number, number];
/** The one curve every animation uses. */
export const ease = cubicBezier(x1, y1, x2, y2);

/** 1 with full effects, 0 with Reduce effects. */
export function shift(): number {
	if (typeof document === 'undefined') return 1;
	const value = getComputedStyle(document.documentElement).getPropertyValue('--shift').trim();
	return value === '0' ? 0 : 1;
}

/**
 * Runs `frame` with eased progress 0..1 over `ms`, once per animation frame. Returns a function
 * that stops it. `ms` 0 runs the last frame at once.
 */
export function tween(ms: number, frame: (progress: number) => void, done?: () => void): () => void {
	if (ms <= 0) {
		frame(1);
		done?.();
		return () => {};
	}
	let start: number | null = null;
	let id = requestAnimationFrame(function step(now) {
		start ??= now;
		const progress = Math.min(1, (now - start) / ms);
		frame(ease(progress));
		if (progress < 1) id = requestAnimationFrame(step);
		else done?.();
	});
	return () => cancelAnimationFrame(id);
}

/**
 * A card leaving or arriving between questions (Round 7, A Slide): it fades while moving 24px, the
 * old card out to the left and the new one in from the right, together. With Reduce effects the
 * move is 0, so it only fades. The leaving card is marked and inert at once, so nothing can reach
 * it while it fades.
 */
export function slide(node: HTMLElement, { direction }: { direction: 'in' | 'out' }) {
	if (direction === 'out') {
		node.inert = true;
		node.dataset.leaving = '';
		node.setAttribute('aria-hidden', 'true');
	}
	const distance = 24 * shift() * (direction === 'out' ? -1 : 1);
	return {
		duration: MOTION.duration.state,
		easing: ease,
		css: (t: number) => `opacity: ${t}; transform: translateX(${(1 - t) * distance}px)`
	};
}

/**
 * When each part of the summary arrives, in ms (Round 7, A Path draws): the first node and the
 * trunk at once, then each edge draws in turn as the node it reaches fades in, then the leaf and
 * its score, then the ring's segments one by one, then the misses. CSS multiplies every delay by
 * `--shift`, so with Reduce effects the summary fades in as a whole.
 */
export function summaryTimeline(earlierCount: number, questions: number) {
	const step = MOTION.duration.state;
	const leaf = earlierCount * step;
	const segments = leaf + step;
	return {
		edge: (index: number) => index * step,
		node: (index: number) => index * step,
		leaf,
		segment: (index: number) => segments + index * 45,
		misses: segments + Math.max(0, questions - 1) * 45 + step
	};
}
