import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { decksPlugin } from './src/lib/content/vitePlugin.ts';

export default defineConfig({
	plugins: [decksPlugin(), sveltekit()],
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
				'src/lib/flags/**/*.ts'
			],
			exclude: ['**/*.test.ts'],
			thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 }
		}
	}
});
