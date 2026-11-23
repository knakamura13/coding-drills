// Applies the "Reduce effects" setting before first paint, so nothing animates at full strength
// for a frame before the app starts. Same rule as readReduceEffects in
// src/lib/ui/effects.svelte.ts; effects.test.ts checks the two agree.
(function () {
	var os = false;
	try {
		os = matchMedia('(prefers-reduced-motion: reduce)').matches;
	} catch (e) {
		os = false;
	}
	var reduced = os;
	try {
		var stored = localStorage.getItem('cd-reduce-effects');
		if (stored === '1' || stored === '0') reduced = stored === '1';
	} catch (e) {
		reduced = os;
	}
	document.documentElement.dataset.effects = reduced ? 'reduced' : 'full';
})();
