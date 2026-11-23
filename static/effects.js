// Marks a saved "Reduce effects" choice on <html> before first paint, so nothing animates at full
// strength for a frame before the app starts. With no saved choice it sets nothing: tokens.css
// then follows the OS reduced-motion setting through its media query, and keeps following it
// if the setting changes while the page is open. Same rule as src/lib/ui/effects.svelte.ts;
// effects.test.ts checks the two agree.
(function () {
	try {
		const stored = localStorage.getItem('cd-reduce-effects');
		if (stored === '1' || stored === '0') {
			document.documentElement.dataset.effects = stored === '1' ? 'reduced' : 'full';
		}
	} catch (e) {
		// Blocked storage: no saved choice, so the OS setting applies.
	}
})();
