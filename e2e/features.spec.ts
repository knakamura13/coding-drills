import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { allDecks, answerMain, continueButton, currentQuestionAny, deck, openMenu, playDeck } from './helpers';
import { failedHistory, history, seed } from './seed';

async function expectNoViolations(page: Page) {
	await page.evaluate(() => Promise.allSettled(document.getAnimations().map((animation) => animation.finished)));
	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
}

test.describe('weak spots', () => {
	test('no card before anything has been missed', async ({ page }) => {
		await seed(page, history(0, true));
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Nothing due' })).toBeVisible();
		await expect(page.getByRole('heading', { name: /you have missed/ })).toHaveCount(0);
		await page.goto('/weak');
		await expect(page).toHaveURL('/');
	});

	test('questions failed before are offered for practice, through the usual lesson loop', async ({ page }) => {
		await seed(page, failedHistory(3));
		await page.goto('/');
		await expect(page.getByRole('heading', { name: `${deck.questions.length} questions you have missed` })).toBeVisible();
		await page.getByRole('link', { name: `Drill ${deck.questions.length} weak spots` }).click();
		await expect(page).toHaveURL('/weak');

		await playDeck(page, () => ({ main: 'right' }));
		await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();
		await expect(page.getByText(`${deck.questions.length} of ${deck.questions.length} right on the first try`)).toBeVisible();
	});

	test('the home screen with weak-spot and practice cards has no accessibility violations', async ({ page }) => {
		await seed(page, failedHistory(3));
		await page.goto('/');
		await expect(page.getByRole('heading', { name: /you have missed/ })).toBeVisible();
		await expectNoViolations(page);
	});
});

test.describe('progress', () => {
	test('says so when there is nothing to show yet', async ({ page }) => {
		await page.goto('/progress');
		await expect(page.getByText('Nothing to show yet.')).toBeVisible();
	});

	test('shows streak, calendar, topics, and decks from the answer history', async ({ page }) => {
		await seed(page, [...history(2, true), ...history(1, true), ...history(0)]);
		await page.goto('/');
		await openMenu(page);
		await page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: 'Progress' }).click();
		await expect(page).toHaveURL('/progress');

		const totals = page.getByRole('region', { name: 'Totals' });
		await expect(totals).toContainText(/3\s*day streak/);
		await expect(totals).toContainText(/3\s*days practiced/);

		await expect(page.getByRole('img', { name: /you practiced on 3 of the last 84 days/ })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Topics' })).toBeVisible();
		await expect(page.getByText('Sliding window', { exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Decks' })).toBeVisible();
		await expect(page.getByText(deck.title, { exact: true })).toBeVisible();
	});

	test('has no accessibility violations with history', async ({ page }) => {
		await seed(page, [...history(2, true), ...history(1), ...history(0)]);
		await page.goto('/progress');
		await expect(page.getByRole('heading', { name: 'Topics' })).toBeVisible();
		await expectNoViolations(page);
	});
});

test.describe('mixed practice', () => {
	// Ten questions on a phone viewport, with six workers sharing the machine, can pass 30 seconds.
	test.slow();

	const total = allDecks.reduce((sum, candidate) => sum + candidate.questions.length, 0);

	test('draws ten questions from every deck and runs the usual lesson loop', async ({ page }) => {
		await page.goto('/');
		const card = page.getByRole('article', { name: 'Mixed practice' });
		await expect(card.getByRole('combobox', { name: 'Topic' })).toHaveValue('');
		await expect(card.getByRole('option', { name: `All topics (${total})` })).toBeAttached();
		await card.getByRole('link', { name: 'Practice 10' }).click();
		await expect(page).toHaveURL('/practice');

		const seen = new Set<string>();
		for (let index = 0; index < 10; index++) {
			const { question, deckId } = await currentQuestionAny(page);
			seen.add(`${deckId}/${question.id}`);
			await answerMain(page, question, question.correct);
			await continueButton(page).click();
		}
		expect(seen.size).toBe(10);
		await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();
		await expect(page.getByText('10 of 10 right on the first try')).toBeVisible();

		// Practice answers are recorded like any other session.
		const attempts = await page.evaluate(() => JSON.parse(localStorage.getItem('coding-drills:v1:attempts') ?? '[]').length);
		expect(attempts).toBe(10);
	});

	test('a topic limits the questions to that topic', async ({ page }) => {
		await page.goto('/');
		const card = page.getByRole('article', { name: 'Mixed practice' });
		const select = card.getByRole('combobox', { name: 'Topic' });
		// Choose the second option, the first real topic, and read its tag and count from the label.
		const options = await select.locator('option').evaluateAll((nodes) =>
			nodes.map((node) => ({ value: (node as HTMLOptionElement).value, label: node.textContent ?? '' }))
		);
		const topic = options.find((option) => option.value !== '')!;
		const count = Number(/\((\d+)\)/.exec(topic.label)![1]);
		await select.selectOption(topic.value);
		const size = Math.min(10, count);
		await card.getByRole('link', { name: `Practice ${size}` }).click();
		await expect(page).toHaveURL(`/practice?tag=${encodeURIComponent(topic.value)}`);

		for (let index = 0; index < size; index++) {
			const { question } = await currentQuestionAny(page);
			expect(question.tags ?? []).toContain(topic.value);
			await answerMain(page, question, question.correct);
			await continueButton(page).click();
		}
		await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();
	});

	test('an unknown topic goes back to the home screen', async ({ page }) => {
		await page.goto('/practice?tag=no-such-topic');
		await expect(page).toHaveURL('/');
	});

	test('the practice card has no accessibility violations', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('article', { name: 'Mixed practice' })).toBeVisible();
		await expectNoViolations(page);
	});
});
