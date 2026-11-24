import { expect, test, type Page } from '@playwright/test';
import { plainText } from '../src/lib/markdown/render.ts';
import { URL, answerRight, cellsDeck, onScreen, violations } from './learn-helpers.ts';

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
	expect(shownText.replace(/\s+/g, ' ')).toContain(plainText(question.workedExample!, 1000));

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
	await page.goto(`/learn/${cellsDeck.id}`);
	await expect(page.getByRole('radio').first()).toBeVisible();
	await expect(sheet(page)).toBeHidden();
});
