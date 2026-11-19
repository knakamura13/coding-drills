// Applies the "Reduce effects" setting before first paint, so nothing animates at full strength
// for a frame. An external file because the content security policy blocks inline scripts.
// Keep in step with src/lib/ui/effects.svelte.ts.
(function () {
	var reduced = false;
	try {
		var stored = localStorage.getItem('cd-reduce-effects');
		reduced = stored === '1' || stored === '0' ? stored === '1' : matchMedia('(prefers-reduced-motion: reduce)').matches;
	} catch (e) {
		reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
	}
	document.documentElement.dataset.effects = reduced ? 'reduced' : 'full';
})();
