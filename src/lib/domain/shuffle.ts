/** Returns a number in [0, 1). `Math.random` in the app, a seeded generator in tests. */
export type Rng = () => number;

/** mulberry32: a tiny seedable generator so shuffles are reproducible. */
export function seededRng(seed: number): Rng {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Fisher-Yates over a copy. */
export function shuffled<T>(items: readonly T[], rng: Rng = Math.random): T[] {
	const copy = items.slice();
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}
