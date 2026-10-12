import { dev } from '$app/environment';

/**
 * Registers the service worker (production only: in development it would cache
 * stale modules) and reloads when a new version takes over, so the page never
 * runs old code against a new cache.
 */
export function registerServiceWorker(): void {
	if (dev || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

	// The first install also changes the controller. That is not an update, so it must not reload.
	const hadController = navigator.serviceWorker.controller !== null;
	let reloading = false;
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (!hadController || reloading) return;
		reloading = true;
		location.reload();
	});

	void navigator.serviceWorker
		// `none` makes the browser revalidate the worker and everything it imports on every update check.
		.register('/service-worker.js', { updateViaCache: 'none' })
		.then((registration) => {
			// Browsers only check for a new worker on navigation, and a home-screen app can stay open for days.
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'visible') void registration.update().catch(() => undefined);
			});
		})
		.catch(() => undefined);
}
