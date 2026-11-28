import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// The new lesson building blocks on /ui (FigCraft Components page).

// The new UI keeps its fades under reduced motion, so axe waits for them: mid-fade, text shows
// through a half-transparent sheet or panel and fails contrast it passes once settled.
async function violations(page: Page) {
	await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)));
	return (await new AxeBuilder({ page }).analyze()).violations;
}

test.beforeEach(async ({ page }) => {
	await page.goto('/ui');
	await expect(page.getByRole('heading', { name: 'UI pieces', level: 1 })).toBeVisible();
	// The page is prerendered, so its buttons exist before they work. The branch is set only once
	// the page has hydrated.
	await expect.poll(() => page.evaluate(() => document.documentElement.dataset.branch)).toBe('sequences-and-search');
});

test('has no accessibility violations, closed and with a sheet open', async ({ page }) => {
	expect(await violations(page)).toEqual([]);
	await page.getByRole('button', { name: 'Open the worked example' }).click();
	await expect(page.getByRole('dialog', { name: 'Worked example' })).toBeVisible();
	expect(await violations(page)).toEqual([]);
});

test('the sheet, outside the page content, still takes the page branch accent', async ({ page }) => {
	await page.getByRole('button', { name: 'Open the quit sheet' }).click();
	const button = page.getByRole('dialog', { name: 'Quit this lesson?' }).getByRole('button', { name: 'Continue' });
	await expect(button).toBeVisible();
	const accent = await button.evaluate((node) => getComputedStyle(node).getPropertyValue('--color-focus-ring').trim().toUpperCase());
	expect(accent).toBe('#F3B957');
	expect(await page.evaluate(() => document.documentElement.dataset.branch)).toBe('sequences-and-search');
});

test('the sheet traps focus, closes on Escape and returns focus to its opener', async ({ page }) => {
	const opener = page.getByRole('button', { name: 'Open the quit sheet' });
	await opener.focus();
	await page.keyboard.press('Enter');
	const sheet = page.getByRole('dialog', { name: 'Quit this lesson?' });
	await expect(sheet).toBeVisible();
	// Focus starts inside, and Tab cycles within the sheet, never back to the page.
	await expect.poll(() => sheet.evaluate((node) => node.contains(document.activeElement))).toBe(true);
	for (let i = 0; i < 4; i++) {
		await page.keyboard.press('Tab');
		const inside = await sheet.evaluate((node) => node.contains(document.activeElement) || document.activeElement === document.body);
		expect(inside).toBe(true);
	}
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	await expect(opener).toBeFocused();
});

test('a tap on the scrim closes the sheet; a tap inside does not', async ({ page }) => {
	await page.getByRole('button', { name: 'Open the quit sheet' }).click();
	const sheet = page.getByRole('dialog', { name: 'Quit this lesson?' });
	await expect(sheet).toBeVisible();
	await sheet.getByText('Your answers so far').click();
	await expect(sheet).toBeVisible();
	await page.mouse.click(5, 5);
	await expect(sheet).toBeHidden();
});

test('the quit control opens the sheet and progress is announced without a visible counter', async ({ page }) => {
	const progress = page.getByRole('progressbar', { name: 'Lesson progress' });
	await expect(progress).toHaveAttribute('aria-valuenow', '3');
	await expect(progress).toHaveAttribute('aria-valuemax', '8');
	await expect(page.getByText('3 of 8')).toHaveCount(0);
	await page.getByRole('button', { name: 'Quit lesson' }).click();
	await expect(page.getByRole('dialog', { name: 'Quit this lesson?' })).toBeVisible();
});

test('long code lines scroll sideways, and the running line is marked', async ({ page }) => {
	const code = page.getByRole('region', { name: 'Code, line 5 running' }).or(page.getByLabel('Code, line 5 running'));
	await expect(code).toBeVisible();
	const wraps = await code.evaluate((node) => {
		const line = node.querySelector('.line');
		return line ? line.getBoundingClientRect().height > parseFloat(getComputedStyle(node).lineHeight) * 1.5 : true;
	});
	expect(wraps).toBe(false);
	const current = code.locator('[aria-current="step"]');
	await expect(current).toHaveCount(1);
	await expect(current).toContainText('for j in range(start, len(items)):');
});

test('the footer stays pinned while its content scrolls under it', async ({ page }) => {
	const frame = page.getByTestId('footer-one');
	const footer = frame.locator('footer');
	const before = await footer.boundingBox();
	await frame.evaluate((node) => node.scrollTo(0, node.scrollHeight));
	const after = await footer.boundingBox();
	expect(after?.y).toBeCloseTo(before?.y ?? 0, 0);
});

test('views replace nested content in place and keep accessible controls', async ({ page }) => {
	await page.getByRole('button', { name: 'Open Settings' }).click();
	const drawer = page.getByRole('dialog');
	await expect(drawer).toHaveAccessibleName('Settings');
	expect(await violations(page)).toEqual([]);
	await drawer.getByRole('button', { name: 'Depth' }).click();
	await expect(drawer).toHaveAccessibleName('Depth');
	expect(await violations(page)).toEqual([]);
	await drawer.getByRole('button', { name: 'Back' }).click();
	await expect(drawer).toHaveAccessibleName('Settings');
	await drawer.getByRole('button', { name: 'Close' }).click();
	await expect(drawer).toBeHidden();
	await expect(page.getByRole('button', { name: 'Open Settings' })).toBeFocused();
});

test('rotating and resizing an open surface selects its matching layout', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.getByRole('button', { name: 'Open Settings' }).click();
	const view = page.getByRole('dialog', { name: 'Settings' });
	await expect(view).toHaveCSS('width', '390px');
	await page.setViewportSize({ width: 844, height: 390 });
	await expect(view).toHaveCSS('width', '400px');
	// Playwright reports zero physical insets. Only the notch simulation reserves 44px.
	await expect(page.locator('html')).toHaveCSS('--safe-left', '0px');
	await page.setViewportSize({ width: 420, height: 390 });
	await page.addStyleTag({ content: ':root { --safe-left: 44px; }' });
	const heading = view.getByRole('heading', { name: 'Settings' });
	expect((await heading.boundingBox())!.x).toBeGreaterThanOrEqual(44);
	await page.setViewportSize({ width: 844, height: 390 });
	expect(await violations(page)).toEqual([]);
	await view.getByRole('button', { name: 'Close' }).click();
	await page.getByRole('button', { name: 'Open the quit sheet' }).click();
	const dialog = page.getByRole('dialog', { name: 'Quit this lesson?' });
	await expect(dialog).toHaveCSS('width', '560px');
	expect(await violations(page)).toEqual([]);
	await page.setViewportSize({ width: 1440, height: 900 });
	await expect(dialog).toHaveCSS('width', '560px');
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(dialog).toHaveCSS('width', '390px');
});
