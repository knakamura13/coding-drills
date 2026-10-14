import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * Node adapter because Railway needs a process listening on PORT. The app has
 * no backend: decks are compiled into the bundle and progress lives in the
 * browser, so the server only serves prerendered pages and static assets.
 *
 * @type {import('@sveltejs/kit').Config}
 */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({ precompress: true }),
		// Stylesheets this small are written into each page, so first paint needs no extra request.
		inlineStyleThreshold: 10000,
		// Registered by hand in src/lib/pwa/register.ts, and only in production.
		serviceWorker: { register: false },
		prerender: {
			handleHttpError: 'fail',
			entries: ['*']
		},
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				// Svelte transitions inject a <style> element; hashes cannot cover those.
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:'],
				'font-src': ['self'],
				'connect-src': ['self'],
				'object-src': ['none'],
				'base-uri': ['self'],
				'frame-ancestors': ['none']
			}
		}
	}
};

export default config;
