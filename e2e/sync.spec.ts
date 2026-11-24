import { expect, test } from '@playwright/test';
import { createAccount, serverState, signIn } from './account';
import { answerMain, continuePastWrong, currentQuestion, deck, firstWrongId, openMenu, playDeck } from './helpers';
import { URL as learnURL, deck as learnDeck, onScreen, playThrough } from './learn-helpers';
import { openOldLesson, seed } from './seed';

const TWO_DAYS_MS = 2 * 86_400_000;

test.describe('accounts and sync', () => {
	test('signed out, settings offers Google sign-in and everything still works locally', async ({ page }) => {
		await page.goto('/');
		await openMenu(page);
		const menu = page.getByRole('dialog', { name: 'Menu' });
		await expect(menu.getByRole('link', { name: 'Settings', exact: true })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Sign in with Google' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);

		await page.goto('/settings');
		await expect(page.getByText('Progress is on this device only.')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Sign in with Google' })).toHaveAttribute('href', '/api/auth/google');

		await playThrough(page, deck.id);
	});

	test('a client ID that is not a Google client ID is reported instead of failing at Google', async ({ page }) => {
		// The e2e server is configured with a bogus ID, so the hop returns straight to the app.
		await page.goto('/settings');
		await page.getByRole('link', { name: 'Sign in with Google' }).click();
		await expect(page.getByText(/GOOGLE_CLIENT_ID should be the Client ID/)).toBeVisible();
		// The message is shown once and the URL is cleaned.
		await expect(page).toHaveURL('/');
	});

	test('answers made on one device show up on another with no save step', async ({ browser, page, request, baseURL }) => {
		const account = await createAccount(request);
		await signIn(page.context(), account, baseURL!);

		// Device A: answer every question, missing the first one.
		await playThrough(page, deck.id, (index) => index === 0);

		// The page syncs in the background shortly after each answer.
		await expect
			.poll(async () => (await serverState(request, account, baseURL!)).attempts.length)
			.toBe(deck.questions.length);

		// Device B: a fresh browser that has never seen this data, two days later.
		const other = await browser.newContext({ baseURL });
		await signIn(other, account, baseURL!);
		const phone = await other.newPage();
		await phone.clock.setFixedTime(new Date(Date.now() + TWO_DAYS_MS));
		await phone.goto('/settings');
		await expect(phone.getByText(account.email)).toBeVisible();
		await phone.goto('/');
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

	test('a deck lesson on a new device counts answers made on another device', async ({ browser, page, request, baseURL }) => {
		const account = await createAccount(request);
		// Device A holds one answer, to the deck's first question, and syncs it on load.
		await seed(page, [
			{
				id: 'device-a-first',
				at: '2026-01-01T12:00:00.000Z',
				day: '2026-01-01',
				deckId: learnDeck.id,
				questionId: learnDeck.questions[0]!.id,
				pickedId: 'seen',
				correct: true
			}
		]);
		await signIn(page.context(), account, baseURL!);
		await page.goto('/settings');
		await expect.poll(async () => (await serverState(request, account, baseURL!)).attempts.length).toBe(1);

		// Device B opens the lesson straight away, before its first sync has run. Once the sync brings
		// in the answer from device A, the untouched lesson is planned again and leads with the second
		// question, the first one this learner has not answered.
		const other = await browser.newContext({ baseURL });
		await signIn(other, account, baseURL!);
		const phone = await other.newPage();
		await phone.goto(learnURL);
		await expect.poll(async () => (await onScreen(phone)).id).toBe(learnDeck.questions[1]!.id);
		await expect(phone.getByRole('dialog')).toHaveCount(0);
		await other.close();
	});

	test('a flag made on one device appears on the other', async ({ browser, page, request, baseURL }) => {
		const account = await createAccount(request);
		await signIn(page.context(), account, baseURL!);
		// Flagging is on the old lesson screen only, which review still runs.
		await openOldLesson(page);
		const question = await currentQuestion(page);
		await answerMain(page, question, firstWrongId(question));
		await page.getByRole('button', { name: 'Flag this question' }).click();
		await page.getByRole('textbox').fill('The second option is also defensible.');
		await page.getByRole('button', { name: 'Save flag' }).click();
		await continuePastWrong(page);

		await expect.poll(async () => (await serverState(request, account, baseURL!)).flags.length).toBe(1);

		const other = await browser.newContext({ baseURL });
		await signIn(other, account, baseURL!);
		const phone = await other.newPage();
		await phone.goto('/');
		await openMenu(phone);
		await expect(phone.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: /Flagged questions\s*1/ })).toBeVisible();
		await other.close();
	});

	test('signing out returns the device to local-only', async ({ page, request, baseURL }) => {
		const account = await createAccount(request);
		await signIn(page.context(), account, baseURL!);
		await page.goto('/');
		await expect(page.getByText(account.email)).toHaveCount(0);
		await page.goto('/settings');
		await expect(page.getByText(account.email)).toBeVisible();

		await page.getByRole('button', { name: 'Sign out' }).click();
		await expect(page.getByRole('link', { name: 'Sign in with Google' })).toBeVisible();
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
