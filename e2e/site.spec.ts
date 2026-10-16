import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { allDecks, DECK_URL, answerMain, continueButton, continuePastWrong, currentQuestion, currentQuestionAny, firstWrongId, playDeck } from './helpers';

test.describe('deployment surface', () => {
	test('the health check answers ok', async ({ request }) => {
		const response = await request.get('/healthz');
		expect(response.status()).toBe(200);
		expect(await response.text()).toBe('ok');
	});

	test('the manifest installs to the home screen and its icons exist', async ({ request }) => {
		const response = await request.get('/manifest.webmanifest');
		expect(response.status()).toBe(200);
		const manifest = await response.json();
		expect(manifest).toMatchObject({
			name: 'Coding Drills',
			display: 'standalone',
			start_url: '/',
			theme_color: '#f6f7fb',
			color_scheme_dark: { theme_color: '#1c1c25', background_color: '#1c1c25' }
		});
		expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
		for (const icon of manifest.icons) {
			const iconResponse = await request.get(icon.src);
			expect(iconResponse.status(), icon.src).toBe(200);
			expect(iconResponse.headers()['content-type']).toContain('image/png');
		}
		expect((await request.get('/apple-touch-icon.png')).status()).toBe(200);
		expect((await request.get('/favicon.svg')).status()).toBe(200);
	});

	test('pages declare the home-screen app meta tags', async ({ page }) => {
		await page.goto('/');
		// SvelteKit emits asset links relative to the page, so compare the resolved URL.
		const manifest = await page.locator('link[rel="manifest"]').evaluate((link) => (link as HTMLLinkElement).href);
		expect(new URL(manifest).pathname).toBe('/manifest.webmanifest');
		await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
		await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
		const themeColors = await page.locator('meta[name="theme-color"]').evaluateAll((nodes) =>
			nodes.map((node) => ({ content: node.getAttribute('content'), media: node.getAttribute('media') }))
		);
		expect(themeColors).toEqual([
			{ content: '#f6f7fb', media: '(prefers-color-scheme: light)' },
			{ content: '#1c1c25', media: '(prefers-color-scheme: dark)' }
		]);
		await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
	});

	test('declares a content security policy', async ({ page }) => {
		// Prerendered pages carry the policy as a meta tag, since they are static files.
		await page.goto('/');
		const policy = await page.locator('meta[http-equiv="content-security-policy"]').getAttribute('content');
		expect(policy).toContain("default-src 'self'");
		expect(policy).toContain("object-src 'none'");
	});
});

async function expectNoViolations(page: Page) {
	// Let any running animation reach its final state before measuring colors.
	// allSettled: a cancelled animation rejects its `finished` promise, which is fine here.
	await page.evaluate(() => Promise.allSettled(document.getAnimations().map((animation) => animation.finished)));
	const results = await new AxeBuilder({ page }).analyze();
	expect(
		results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((n) => n.target).join(', ')}`)
	).toEqual([]);
}

test.describe('accessibility', () => {
	test('home', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Coding Drills', level: 1 })).toBeVisible();
		// The next-up card names its deck, so its "Start" says where it leads.
		await expect(page.getByRole('link', { name: /^Start / })).toBeVisible();
		await expectNoViolations(page);
	});

	test('a question, its wrong-answer sheet, and the See why dialog', async ({ page }) => {
		await page.goto(DECK_URL);
		const question = await currentQuestion(page);
		await expectNoViolations(page);

		await answerMain(page, question, firstWrongId(question));
		await expect(page.getByRole('heading', { name: 'Not quite.' })).toBeVisible();
		await expectNoViolations(page);

		await page.getByRole('button', { name: 'Why?', exact: true }).click();
		await expect(page.getByRole('dialog', { name: 'Why the answers differ' })).toBeVisible();
		await expectNoViolations(page);
	});

	test('a follow-up and its feedback', async ({ page }) => {
		await page.goto(DECK_URL);
		const question = await currentQuestion(page);
		await answerMain(page, question, firstWrongId(question));
		await continuePastWrong(page);
		await expect(page.getByText('Follow-up', { exact: true })).toBeVisible();
		await expectNoViolations(page);
	});

	test('the correct-answer sheet and the summary', async ({ page }) => {
		await page.goto(DECK_URL);
		const question = await currentQuestion(page);
		await answerMain(page, question, question.correct);
		await expect(page.getByRole('heading', { name: 'Well done!' })).toBeVisible();
		await expectNoViolations(page);
		await continueButton(page).click();

		// Finish the rest, with one miss so the summary lists something.
		await playDeck(
			page,
			(current, index) =>
				index === 1 ? { main: firstWrongId(current), followUpRight: true } : { main: 'right' },
			1
		);
		await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();
		await expect(page.locator('.miss')).toHaveCount(1);
		await expectNoViolations(page);
	});

	test('the flag dialog and the flags page', async ({ page }) => {
		await page.goto(DECK_URL);
		const question = await currentQuestion(page);
		await answerMain(page, question, question.correct);
		await page.getByRole('button', { name: 'Flag this question' }).click();
		await expect(page.getByRole('dialog', { name: 'Flag this question' })).toBeVisible();
		await expectNoViolations(page);
		await page.getByRole('button', { name: 'Save flag' }).click();

		await page.goto('/flags');
		await expect(page.getByRole('heading', { name: 'Flagged questions' })).toBeVisible();
		await expectNoViolations(page);
	});
});

test.describe('layout on a phone', () => {
	// A tree or a call written out on one line is a long unbreakable string. It must wrap inside the
	// card instead of widening the page, which on a phone shrinks everything and breaks taps.
	for (const deckId of ['trees-traversals-bst', 'linked-lists', 'graph-algorithms', 'recursion-backtracking', 'two-dimensional-dp-greedy']) {
		const phoneDeck = allDecks.find((candidate) => candidate.id === deckId);
		if (!phoneDeck) throw new Error(`missing deck ${deckId}`);
		test(`${deckId}: no question or follow-up scrolls sideways`, async ({ page }) => {
			await page.goto(`/play/${deckId}`);
			for (let step = 0; step < phoneDeck.questions.length; step++) {
				const { question } = await currentQuestionAny(page);
				const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
				expect(await overflow(), `${question.id}`).toBeLessThanOrEqual(0);
				await answerMain(page, question, firstWrongId(question));
				await continuePastWrong(page);
				await page.getByText('Follow-up', { exact: true }).waitFor();
				expect(await overflow(), `${question.id} follow-up`).toBeLessThanOrEqual(0);
				await page.getByRole('radio').first().check();
				await page.getByRole('button', { name: 'Check', exact: true }).click();
				await continueButton(page).click();
			}
			await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();
		});
	}
});
