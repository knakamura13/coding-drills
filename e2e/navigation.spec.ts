import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { DECK_URL, allDecks, currentQuestion, deck, openMenu } from './helpers';
import { failedHistory, history, seed } from './seed';

async function expectNoViolations(page: Page) {
	await page.evaluate(() => Promise.allSettled(document.getAnimations().map((animation) => animation.finished)));
	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
}

/** The top bar's menu button. Its name is "Menu", or "Menu, N due" when questions are due. */
const menuButton = (page: Page) => page.getByRole('button', { name: /^Menu(, \d+ due)?$/ });
const drawer = (page: Page) => page.getByRole('dialog', { name: 'Menu' });

test.describe('the menu', () => {
	test('opens from the top bar, lists the sections, and closes when a page is chosen', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('button[aria-haspopup="dialog"]')).toHaveAttribute('aria-expanded', 'false');
		await openMenu(page);
		await expect(drawer(page)).toBeVisible();
		await expect(page.locator('button[aria-haspopup="dialog"]')).toHaveAttribute('aria-expanded', 'true');
		for (const name of ['Home', 'Mixed practice', 'All decks', 'Progress', 'Flagged questions']) {
			await expect(drawer(page).getByRole('link', { name })).toBeVisible();
		}

		await drawer(page).getByRole('link', { name: 'Progress' }).click();
		await expect(page).toHaveURL('/progress');
		await expect(drawer(page)).toBeHidden();
		await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();
	});

	test('Escape closes it and returns focus to the menu button', async ({ page }) => {
		await page.goto('/');
		await openMenu(page);
		await expect(drawer(page)).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(drawer(page)).toBeHidden();
		await expect(menuButton(page)).toBeFocused();
	});

	test('the menu button and the menu report questions due', async ({ page }) => {
		await seed(page, failedHistory(3));
		await page.goto('/');
		await page.getByRole('button', { name: /^Menu, \d+ due$/ }).click();
		await expect(drawer(page).getByRole('link', { name: /^Review \d+ due$/ })).toBeVisible();
		await expect(drawer(page).getByRole('link', { name: /^Weak spots/ })).toBeVisible();
	});

	test('a lesson has no menu, so a session is left only through its own control', async ({ page }) => {
		await page.goto(DECK_URL);
		await expect(page.getByRole('button', { name: 'Quit lesson' })).toBeVisible();
		await expect(page.getByRole('button', { name: /^Menu/ })).toHaveCount(0);
	});

	test('the open menu has no accessibility violations', async ({ page }) => {
		await page.goto('/');
		await openMenu(page);
		await expect(drawer(page)).toBeVisible();
		await expectNoViolations(page);
	});
});

test.describe('decks', () => {
	test('a row starts its deck in one tap', async ({ page }) => {
		await page.goto('/decks');
		await expect(page.getByRole('heading', { name: 'Decks', level: 1 })).toBeVisible();
		await page.locator(`a[href="/play/${deck.id}"]`).click();
		await expect(page).toHaveURL(DECK_URL);
		const first = await currentQuestion(page);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(first.heading ?? deck.heading!);
	});

	test('filters by words in the title or description, and "/" moves to the filter', async ({ page }) => {
		await page.goto('/decks');
		const filter = page.getByRole('searchbox', { name: 'Filter decks' });
		// The page is prerendered, so "/" works only once it has hydrated. WebKit can finish that after the load event.
		await expect(async () => {
			await page.keyboard.press('/');
			await expect(filter).toBeFocused({ timeout: 500 });
		}).toPass({ timeout: 10_000 });

		await filter.fill('zzqx');
		await expect(page.getByText('No decks match “zzqx”.')).toBeVisible();

		await filter.fill(deck.title);
		await expect(page.locator(`a[href="/play/${deck.id}"]`)).toBeVisible();

		await filter.fill('');
		await expect(page.locator('a[href^="/play/"]')).toHaveCount(allDecks.length);
	});

	test('has no accessibility violations', async ({ page }) => {
		await page.goto('/decks');
		await expect(page.locator('a[href^="/play/"]').first()).toBeVisible();
		await expectNoViolations(page);
	});
});

test.describe('single-key shortcuts', () => {
	test('can be switched off, and number keys then do nothing in a lesson', async ({ page }) => {
		await page.goto('/settings');
		await page.getByRole('switch', { name: 'Single-key shortcuts' }).uncheck();

		await page.goto(DECK_URL);
		await currentQuestion(page);
		await page.keyboard.press('1');
		await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);

		// Switching them back on restores the number keys.
		await page.goto('/settings');
		await page.getByRole('switch', { name: 'Single-key shortcuts' }).check();
		await page.goto(DECK_URL);
		await currentQuestion(page);
		await page.keyboard.press('1');
		await expect(page.getByRole('radio', { checked: true })).toHaveCount(1);
	});
});

test.describe('keyboard and connection', () => {
	test('the first Tab reaches a skip link that moves focus past the top bar', async ({ page, browserName }) => {
		// Safari does not move the Tab key to links unless its "press Tab to highlight" setting is on.
		test.skip(browserName === 'webkit', 'WebKit Tab order skips links by default');
		await page.goto('/');
		await page.keyboard.press('Tab');
		await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(page.locator('#content')).toBeFocused();
	});

	test('the top bar shows when the connection is lost', async ({ page, context }) => {
		await page.goto('/');
		await context.setOffline(true);
		await expect(page.getByText('Offline', { exact: true })).toBeVisible();
		await context.setOffline(false);
		await expect(page.getByText('Offline', { exact: true })).toBeHidden();
	});
});

test.describe('stability', () => {
	// Largest Contentful Paint and Cumulative Layout Shift are what Lighthouse reports. The cards that
	// depend on stored progress fill slots that already have their height, so the page must not move.
	test('the home screen does not shift when stored progress arrives', async ({ page }) => {
		await seed(page, [...history(2, true), ...history(1, true)]);
		await page.addInitScript(() => {
			const shifts = { total: 0 };
			(window as unknown as { shifts: typeof shifts }).shifts = shifts;
			new PerformanceObserver((list) => {
				for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
					if (!entry.hadRecentInput) shifts.total += entry.value;
				}
			}).observe({ type: 'layout-shift', buffered: true });
		});

		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Nothing due' })).toBeVisible();
		await expect(page.getByRole('link', { name: /^Start / })).toBeVisible();
		const shift = await page.evaluate(() => (window as unknown as { shifts: { total: number } }).shifts.total);
		expect(shift).toBeLessThan(0.01);
	});
});
