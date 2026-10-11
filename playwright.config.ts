/**
 * End-to-end tests against the real production build: `pnpm build`, then the
 * adapter-node server. Locally, `PW_CHANNEL=chrome pnpm test:e2e` reuses the
 * installed Chrome instead of downloading Chromium. The iphone project needs
 * WebKit: `pnpm exec playwright install webkit`. CI installs both.
 */

import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const ORIGIN = `http://localhost:${PORT}`;
const channel = process.env.PW_CHANNEL || undefined;

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? 'line' : 'list',
	// Mobile emulation hydrates slowly on a cold parallel run; 5s flakes.
	expect: { timeout: 10_000 },
	use: {
		baseURL: ORIGIN,
		// Slide and fade animations would otherwise make color-contrast scans race the final state.
		reducedMotion: 'reduce',
		trace: 'retain-on-failure'
	},
	projects: [
		{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, channel } },
		{ name: 'mobile', use: { ...devices['Pixel 7'], channel } },
		// WebKit is the engine behind iPhone Safari and home-screen apps.
		{ name: 'iphone', use: { ...devices['iPhone 16 Pro'] } }
	],
	webServer: {
		command: 'pnpm build && node build/index.js',
		url: `${ORIGIN}/healthz`,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		env: { PORT: String(PORT) }
	}
});
