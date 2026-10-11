import { expect, test } from '@playwright/test';
import { createAccount, serverState, signIn } from './account';
import { DECK_URL, answerMain, continueButton, currentQuestion, deck, firstWrongId, playDeck } from './helpers';

const TWO_DAYS_MS = 2 * 86_400_000;

test.describe('accounts and sync', () => {
	test('signed out, the home screen offers Google sign-in and everything still works locally', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByText('Progress is on this device only.')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Sign in with Google to sync' })).toHaveAttribute(
			'href',
			'/api/auth/google'
		);

		await page.goto(DECK_URL);
		await playDeck(page, () => ({ main: 'right' }));
		await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();
	});

	test('a client ID that is not a Google client ID is reported instead of failing at Google', async ({ page }) => {
		// The e2e server is configured with a bogus ID, so the hop returns straight to the app.
		await page.goto('/');
		await page.getByRole('link', { name: 'Sign in with Google to sync' }).click();
		await expect(page.getByText(/GOOGLE_CLIENT_ID should be the Client ID/)).toBeVisible();
		// The message is shown once and the URL is cleaned.
		await expect(page).toHaveURL('/');
	});

	test('answers made on one device show up on another with no save step', async ({ browser, page, request, baseURL }) => {
		const account = await createAccount(request);
		await signIn(page.context(), account, baseURL!);

		// Device A: answer every question, missing the first one.
		await page.goto(DECK_URL);
		await playDeck(page, (question, index) =>
			index === 0 ? { main: firstWrongId(question), followUpRight: true } : { main: 'right' }
		);
		await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();

		// The page syncs in the background shortly after each answer.
		await expect
			.poll(async () => (await serverState(request, account, baseURL!)).attempts.length)
			.toBe(deck.questions.length);

		// Device B: a fresh browser that has never seen this data, two days later.
		const other = await browser.newContext({ baseURL });
		await signIn(other, account, baseURL!);
		const phone = await other.newPage();
		await phone.clock.setFixedTime(new Date(Date.now() + TWO_DAYS_MS));
		await phone.goto('/');
		await expect(phone.getByText(`Synced as ${account.email}`)).toBeVisible();
		await expect(phone.getByText(`${deck.questions.length} questions due`)).toBeVisible();

		// Reviewing there syncs back with no save button either.
		await phone.getByRole('link', { name: `Review ${deck.questions.length}` }).click();
		await playDeck(phone, () => ({ main: 'right' }));
		await expect(phone.getByRole('heading', { name: 'Session complete' })).toBeVisible();
		await expect
			.poll(async () => (await serverState(request, account, baseURL!)).attempts.length)
			.toBe(deck.questions.length * 2);
		await other.close();
	});

	test('a flag made on one device appears on the other', async ({ browser, page, request, baseURL }) => {
		const account = await createAccount(request);
		await signIn(page.context(), account, baseURL!);
		await page.goto(DECK_URL);
		const question = await currentQuestion(page);
		await answerMain(page, question, firstWrongId(question));
		await page.getByRole('button', { name: 'Flag this question' }).click();
		await page.getByRole('textbox').fill('The second option is also defensible.');
		await page.getByRole('button', { name: 'Save flag' }).click();
		await continueButton(page).click();

		await expect.poll(async () => (await serverState(request, account, baseURL!)).flags.length).toBe(1);

		const other = await browser.newContext({ baseURL });
		await signIn(other, account, baseURL!);
		const phone = await other.newPage();
		await phone.goto('/');
		await expect(phone.getByRole('link', { name: '1 flagged question' })).toBeVisible();
		await other.close();
	});

	test('signing out returns the device to local-only', async ({ page, request, baseURL }) => {
		const account = await createAccount(request);
		await signIn(page.context(), account, baseURL!);
		await page.goto('/');
		await expect(page.getByText(`Synced as ${account.email}`)).toBeVisible();

		await page.getByRole('button', { name: 'Sign out' }).click();
		await expect(page.getByRole('link', { name: 'Sign in with Google to sync' })).toBeVisible();
		const me = await page.request.get('/api/me');
		expect(await me.json()).toEqual({ user: null });
	});

	test('a request from another origin cannot write', async ({ request, baseURL }) => {
		const account = await createAccount(request);
		expect(baseURL).toBeTruthy();
		const response = await request.post('/api/sync', {
			headers: { cookie: `session=${account.token}`, origin: 'https://evil.example' },
			data: { cursor: 0, attempts: [], flags: [] }
		});
		expect(response.status()).toBe(403);
	});

	test('rejects an unauthenticated sync', async ({ request, baseURL }) => {
		const response = await request.post('/api/sync', {
			headers: { origin: baseURL! },
			data: { cursor: 0, attempts: [], flags: [] }
		});
		expect(response.status()).toBe(401);
	});
});
