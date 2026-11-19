import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
import { decksPlugin } from './src/lib/content/vitePlugin.ts';

export default defineConfig({
	plugins: [
		decksPlugin(),
		sveltekit({
			preprocess: vitePreprocess(),
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
			},
			// Kit 3 stopped generating the $lib alias. Declaring it here keeps the existing imports working.
			alias: {
				$lib: 'src/lib'
			}
		})
	],
	build: {
		// Vite 8's documented Baseline Widely Available target makes the
		// browser-support policy explicit for contributors and deploys.
		target: 'baseline-widely-available'
	},
	test: {
		// Everything under test is pure TypeScript, so node is enough.
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,ts}'],
		coverage: {
			provider: 'v8',
			include: [
				'src/lib/content/schema.ts',
				'src/lib/content/loadDecks.ts',
				'src/lib/domain/**/*.ts',
				'src/lib/markdown/**/*.ts',
				'src/lib/storage/**/*.ts',
				'src/lib/ui/**/*.ts'
			],
			exclude: ['**/*.test.ts'],
			thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 }
		}
	}
});
