import { expect, test, type Page } from '@playwright/test';
import { createAccount, signIn } from './account.ts';
import { URL, answerRight, cellsDeck, deck, onScreen, violations } from './learn-helpers.ts';
import { markdownParts } from './helpers.ts';

// Lesson Round 2: on a deck the learner has never answered in, the first question's worked example
// opens by itself; after that only the link opens it. Unlike learn.spec.ts, these tests start with
// no saved answers. Every boundary-search question has a worked example.

const sheet = (page: Page) => page.getByRole('dialog', { name: 'Worked example' });
const exampleLink = (page: Page) => page.getByRole('button', { name: 'Walk through a worked example' });

test('a deck never answered in opens the first worked example, and opens it again until an answer is saved', async ({ page }) => {
	await page.goto(URL);
	await expect(sheet(page)).toBeVisible();
	await expect(sheet(page).getByRole('button', { name: 'Close' })).toBeFocused();
	const shownText = await sheet(page).innerText();
	expect(await violations(page)).toEqual([]);
	await page.keyboard.press('Escape');
	await expect(sheet(page)).toBeHidden();
	await expect(exampleLink(page)).toBeFocused();
	const question = await onScreen(page);
	for (const part of markdownParts(question.workedExample!)) expect(shownText.replace(/\s+/g, ' ')).toContain(part);

	// Leaving without an answer saves nothing, so the next visit is still a first visit.
	await page.reload();
	await expect(sheet(page)).toBeVisible();
});

test('once an answer is saved it stays closed: on the next question and on the next visit', async ({ page }) => {
	await page.goto(URL);
	await sheet(page).getByRole('button', { name: 'Close' }).click();
	await answerRight(page, await onScreen(page));
	await onScreen(page);
	await expect(exampleLink(page)).toBeVisible();
	await expect(sheet(page)).toBeHidden();

	await page.reload();
	await expect(exampleLink(page)).toBeVisible();
	await expect(sheet(page)).toBeHidden();
});

test('a deck without worked examples opens nothing', async ({ page }) => {
	await page.goto(`/play/${cellsDeck.id}`);
	await expect(page.getByRole('radio').first()).toBeVisible();
	await expect(sheet(page)).toBeHidden();
});

test('a signed-in device waits for its first sync, so an answer from another device counts as seen', async ({ page, request, baseURL }) => {
	const account = await createAccount(request);
	// The other device's answer, already on the server; this browser has never synced.
	const pushed = await request.post('/api/sync', {
		headers: { cookie: `session=${account.token}`, origin: baseURL! },
		data: {
			cursor: 0,
			flags: [],
			attempts: [
				{
					id: 'other-device-1',
					at: '2026-01-01T12:00:00.000Z',
					day: '2026-01-01',
					deckId: deck.id,
					questionId: deck.questions[0]!.id,
					pickedId: 'seen',
					correct: true
				}
			]
		}
	});
	expect(pushed.ok()).toBe(true);
	await signIn(page.context(), account, baseURL!);

	await page.goto(URL);
	const synced = () => page.evaluate(() => localStorage.getItem('facet:v1:attempts') ?? '');
	await expect.poll(synced).toContain('other-device-1');
	await expect(exampleLink(page)).toBeVisible();
	await expect(sheet(page)).toBeHidden();
});
