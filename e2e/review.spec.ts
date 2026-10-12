import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { DECK_URL, answerFollowUp, answerMain, continueButton, currentQuestion, deck, firstWrongId, playDeck } from './helpers';
import { history, seed } from './seed';

test.describe('spaced review', () => {
	test('a fresh device shows no review card', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Coding Drills' })).toBeVisible();
		await expect(page.getByRole('article', { name: /due|Nothing due/ })).toHaveCount(0);
		await expect(page.getByRole('link', { name: /^Review/ })).toHaveCount(0);
	});

	test('playing a deck schedules it, and the card says when the next review is', async ({ page }) => {
		await page.goto(DECK_URL);
		await playDeck(page, () => ({ main: 'right' }));
		await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();
		await expect(page.getByText('Next review tomorrow.')).toBeVisible();

		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Nothing due' })).toBeVisible();
		await expect(page.getByText('Next review tomorrow.')).toBeVisible();
		await expect(page.getByText(/\d of \d learned/)).toBeVisible();
	});

	test('the questions due are the ones from earlier days, reviewed through the usual lesson loop', async ({ page }) => {
		await seed(page, history(3));
		await page.goto('/');
		await expect(page.getByText(`${deck.questions.length} questions due`)).toBeVisible();
		await page.getByRole('link', { name: `Review ${deck.questions.length}` }).click();
		await expect(page).toHaveURL('/review');

		// A miss in review still gets its follow-up, exactly like a deck session.
		const first = await currentQuestion(page);
		await answerMain(page, first, firstWrongId(first));
		await continueButton(page).click();
		await page.getByText('Follow-up', { exact: true }).waitFor();
		await answerFollowUp(page, first, firstWrongId(first), true);
		await continueButton(page).click();

		await playDeck(page, () => ({ main: 'right' }), 1);
		await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();
		await expect(page.getByText('Next review tomorrow.')).toBeVisible();

		// The sitting moved the schedule: nothing is due any more.
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Nothing due' })).toBeVisible();
	});

	test('retaking a deck on the same day does not change the schedule', async ({ page }) => {
		await seed(page, history(3));
		await page.goto(DECK_URL);
		await playDeck(page, (question) => ({ main: firstWrongId(question), followUpRight: false }));
		await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();
		await page.goto('/');
		// Every question was missed today, so all are due again tomorrow, not today.
		await expect(page.getByRole('heading', { name: 'Nothing due' })).toBeVisible();

		await page.goto(DECK_URL);
		await playDeck(page, () => ({ main: 'right' }));
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Nothing due' })).toBeVisible();
		await expect(page.getByText('Next review tomorrow.')).toBeVisible();
	});

	test('a day streak shows after answering on consecutive days', async ({ page }) => {
		await seed(page, [...history(2, true), ...history(1, true)]);
		await page.goto(DECK_URL);
		await playDeck(page, () => ({ main: 'right' }));
		await page.goto('/');
		await expect(page.getByText('3 day streak')).toBeVisible();
	});

	test('review with nothing due returns to the home screen', async ({ page }) => {
		await page.goto('/review');
		await expect(page).toHaveURL('/');
	});

	test('the home screen with a due review card has no accessibility violations', async ({ page }) => {
		await seed(page, history(3));
		await page.goto('/');
		await expect(page.getByText(`${deck.questions.length} questions due`)).toBeVisible();
		await page.evaluate(() => Promise.allSettled(document.getAnimations().map((animation) => animation.finished)));
		const results = await new AxeBuilder({ page }).analyze();
		expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
	});
});
