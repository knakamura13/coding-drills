import { dev, version } from '$app/env';
import { VERSION_QUERY, VERSION_TIMEOUT_MS } from './protocol';

/**
 * Registers the service worker (production only: in development it would cache
 * stale modules) and reloads when a different build takes over, so the page never
 * runs old code against a new cache.
 */
export function registerServiceWorker(): void {
	if (dev || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

	// The first install also changes the controller, and that must not reload: the reload would drop
	// what the page has already taken from its URL, such as the sign-in notice. Neither the controller
	// at mount nor the caches tell the cases apart reliably. Instrumented runs on WebKit showed the
	// worker can claim the page just before mount and fire the event just after (#191). On an update
	// the event can come before the new worker clears the old caches. So the page asks the worker.
	let reloading = false;
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		const worker = navigator.serviceWorker.controller;
		if (!worker) return;
		void workerVersion(worker).then((theirs) => {
			if (theirs === version || reloading) return;
			reloading = true;
			location.reload();
		});
	});

	void navigator.serviceWorker
		// Kit 3 emits an ES module worker. `none` makes the browser revalidate it, and everything it
		// imports, on every update check.
		.register('/service-worker.js', { type: 'module', updateViaCache: 'none' })
		.then((registration) => {
			// Browsers only check for a new worker on navigation, and a home-screen app can stay open for days.
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'visible') void registration.update().catch(() => undefined);
			});
		})
		.catch(() => undefined);
}

/** The build a worker was made from, or undefined when it does not answer in time. */
function workerVersion(worker: ServiceWorker): Promise<string | undefined> {
	return new Promise((resolve) => {
		const channel = new MessageChannel();
		const timer = setTimeout(() => resolve(undefined), VERSION_TIMEOUT_MS);
		channel.port1.onmessage = (event) => {
			clearTimeout(timer);
			channel.port1.close();
			resolve(typeof event.data === 'string' ? event.data : undefined);
		};
		try {
			worker.postMessage(VERSION_QUERY, [channel.port2]);
		} catch {
			// A worker that was replaced before it could be asked cannot answer.
			clearTimeout(timer);
			resolve(undefined);
		}
	});
}
