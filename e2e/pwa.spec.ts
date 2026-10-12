import { expect, test, type Page } from '@playwright/test';
import { DECK_URL, answerMain, continueButton, currentQuestion, deck, firstWrongId } from './helpers';

/** Waits until the service worker controls the page and has cached `path`. */
async function waitForOfflineReady(page: Page, path: string) {
	await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
	await expect
		.poll(() =>
			page.evaluate(async (target) => {
				for (const key of await caches.keys()) {
					if (await (await caches.open(key)).match(target)) return true;
				}
				return false;
			}, path)
		)
		.toBe(true);
}

test.describe('installable and offline', () => {
	test('the manifest names the app, its scope, and its shortcuts', async ({ request }) => {
		const manifest = await (await request.get('/manifest.webmanifest')).json();
		expect(manifest).toMatchObject({ id: '/', scope: '/', start_url: '/', display: 'standalone' });
		expect(manifest.shortcuts.map((shortcut: { url: string }) => shortcut.url)).toEqual(['/review', '/weak', '/practice']);
		for (const shortcut of manifest.shortcuts) expect((await request.get(shortcut.url)).status()).toBe(200);
	});

	test('the deck list the service worker reads is served', async ({ request }) => {
		const response = await request.get('/decks.json');
		expect(response.status()).toBe(200);
		expect(await response.json()).toContain(deck.id);
	});

	test('the service worker takes control and the app keeps working with no connection', async ({ page, context }) => {
		await page.goto('/');
		await waitForOfflineReady(page, DECK_URL);
		await waitForOfflineReady(page, '/review');

		await context.setOffline(true);

		// A lesson loads and records an answer with the network down.
		await page.goto(DECK_URL);
		const question = await currentQuestion(page);
		await answerMain(page, question, firstWrongId(question));
		await continueButton(page).click();
		await page.getByText('Follow-up', { exact: true }).waitFor();
		const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('coding-drills:v1:attempts') ?? '[]').length);
		expect(saved).toBe(0); // The attempt is written when the follow-up finishes.

		// Other pages load from the cache too, and the API is not served from it.
		await page.goto('/progress');
		await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Coding Drills', level: 1 })).toBeVisible();
		await expect(page.getByRole('article', { name: deck.title })).toBeVisible();
		const apiFailed = await page.evaluate(() => fetch('/api/me').then(() => false, () => true));
		expect(apiFailed).toBe(true);

		await context.setOffline(false);
	});

	test('a whole lesson can be finished offline and its answers are kept', async ({ page, context }) => {
		await page.goto('/');
		await waitForOfflineReady(page, DECK_URL);
		await context.setOffline(true);

		await page.goto(DECK_URL);
		for (let index = 0; index < deck.questions.length; index++) {
			const question = await currentQuestion(page);
			await answerMain(page, question, question.correct);
			await continueButton(page).click();
		}
		await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();
		const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('coding-drills:v1:attempts') ?? '[]').length);
		expect(saved).toBe(deck.questions.length);
		await context.setOffline(false);
	});
});
