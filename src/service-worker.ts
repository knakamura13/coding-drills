/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, prerendered, version } from '$service-worker';

/**
 * Makes the app work with no connection.
 *
 * - The build output, static files, and prerendered pages are cached when this
 *   version installs. The decks are compiled into those scripts, so every
 *   lesson works offline.
 * - The pages that render only in the browser (a lesson, review, weak spots,
 *   practice) are cached too. Their HTML is the same shell for every visit.
 * - Page loads go to the network first and fall back to the cache, so a deploy
 *   shows up on the next load. Requests to /api are never touched: answers are
 *   saved on the device first and the sync engine retries them online.
 * - A new version takes over at once (skipWaiting and claim) and the page
 *   reloads when the controller changes.
 */

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `drills-${version}`;
const CLIENT_ROUTES = ['/review', '/weak', '/practice'];
const NETWORK_TIMEOUT_MS = 4000;
const ASSETS = [...build, ...files, ...prerendered].filter((path) => path !== '/healthz');

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(ASSETS);

			// Best effort: a page that fails to cache here is cached the first time it is visited.
			const deckIds: string[] = await fetch('/decks.json')
				.then((response) => (response.ok ? response.json() : []))
				.catch(() => []);
			const pages = [...CLIENT_ROUTES, ...deckIds.map((id) => `/play/${id}`)];
			await Promise.all(pages.map((page) => cache.add(page).catch(() => undefined)));

			await sw.skipWaiting();
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key.startsWith('drills-') && key !== CACHE) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

/** `AbortSignal.timeout` is missing in older Safari. Without it a request just waits for the network. */
function timeoutSignal(ms: number): AbortSignal | undefined {
	return typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(ms) : undefined;
}

async function page(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE);
	const { pathname } = new URL(request.url);
	try {
		const response = await fetch(request, { signal: timeoutSignal(NETWORK_TIMEOUT_MS) });
		// Keyed by path alone, so /practice?tag=x and /?auth=failed reuse one shell.
		if (response.ok && !response.redirected) await cache.put(pathname, response.clone());
		return response;
	} catch {
		return (await cache.match(pathname)) ?? (await cache.match('/')) ?? Response.error();
	}
}

async function asset(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE);
	const cached = await cache.match(request);
	if (cached) return cached;
	try {
		const response = await fetch(request);
		if (response.ok && new URL(request.url).pathname.startsWith('/_app/')) await cache.put(request, response.clone());
		return response;
	} catch {
		return Response.error();
	}
}

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== sw.location.origin) return;
	if (url.pathname.startsWith('/api/') || url.pathname === '/healthz') return;
	event.respondWith(request.mode === 'navigate' ? page(request) : asset(request));
});
