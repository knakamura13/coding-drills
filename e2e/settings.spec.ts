import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { plainText } from '../src/lib/markdown/render.ts';
import { DECK_URL, answerMain, continueButton, currentQuestion, firstWrongId, openMenu, optionOf } from './helpers';

async function expectNoViolations(page: Page) {
	await page.evaluate(() => Promise.allSettled(document.getAnimations().map((animation) => animation.finished)));
	const results = await new AxeBuilder({ page }).analyze();
	expect(
		results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((n) => n.target).join(', ')}`)
	).toEqual([]);
}

test.describe('settings', () => {
	test('is linked from the menu and has a back control', async ({ page }) => {
		await page.goto('/');
		await openMenu(page);
		await page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: 'Settings', exact: true }).click();
		await expect(page).toHaveURL('/settings');
		await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
		await page.getByRole('link', { name: 'Back' }).click();
		await expect(page).toHaveURL('/');
	});

	test('toggles and appearance persist on this device', async ({ page }) => {
		await page.goto('/settings');
		await page.getByRole('switch', { name: 'Sound effects' }).click();
		await page.getByRole('switch', { name: 'Haptics' }).click();
		await page.getByRole('switch', { name: 'Immediate feedback on quizzes' }).click();
		const dialog = page.getByRole('dialog', { name: 'Immediate feedback is on' });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByText('Unanswered')).toBeVisible();
		await expect(dialog.getByText('Correct', { exact: true })).toBeVisible();
		await expect(dialog.getByText('Wrong', { exact: true })).toBeVisible();
		await expect(dialog.getByRole('button')).toHaveCount(1);
		await dialog.getByRole('button', { name: 'Got it' }).click();
		await expect(dialog).toHaveCount(0);

		await page.getByRole('radio', { name: 'Dark', exact: true }).check();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
		await page.reload();
		await expect(page.getByRole('switch', { name: 'Sound effects' })).toBeChecked();
		await expect(page.getByRole('switch', { name: 'Haptics' })).toBeChecked();
		await expect(page.getByRole('switch', { name: 'Immediate feedback on quizzes' })).toBeChecked();
		await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
		await expect(page.getByRole('dialog')).toHaveCount(0);
	});

	test('system appearance follows the device, and an explicit choice does not', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'light' });
		await page.goto('/settings');
		await expect(page.getByRole('radio', { name: 'System', exact: true })).toBeChecked();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

		await page.emulateMedia({ colorScheme: 'dark' });
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

		await page.getByRole('radio', { name: 'Light', exact: true }).check();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
		await expect(page.locator('#theme-color-choice')).toHaveAttribute('content', '#f6f7fb');
	});

	test('sound and haptics fire only when their toggles are on', async ({ page }) => {
		await page.addInitScript(() => {
			const target = window as Window & { __tones: number; __vibrations: number };
			target.__tones = 0;
			target.__vibrations = 0;
			const original = AudioContext.prototype.createOscillator;
			AudioContext.prototype.createOscillator = function () {
				target.__tones += 1;
				return original.call(this);
			};
			navigator.vibrate = () => {
				target.__vibrations += 1;
				return true;
			};
		});

		await page.goto(DECK_URL);
		const first = await currentQuestion(page);
		await answerMain(page, first, first.correct);
		await expect.poll(() => page.evaluate(() => (window as Window & { __tones: number }).__tones)).toBe(0);
		await expect.poll(() => page.evaluate(() => (window as Window & { __vibrations: number }).__vibrations)).toBe(0);
		await continueButton(page).click();

		await page.goto('/settings');
		await page.getByRole('switch', { name: 'Sound effects' }).click();
		await page.getByRole('switch', { name: 'Haptics' }).click();
		await page.goto(DECK_URL);
		const second = await currentQuestion(page);
		await answerMain(page, second, second.correct);
		await expect.poll(() => page.evaluate(() => (window as Window & { __tones: number }).__tones)).toBeGreaterThan(0);
		await expect
			.poll(() => page.evaluate(() => (window as Window & { __vibrations: number }).__vibrations))
			.toBeGreaterThan(0);
	});

	test('immediate feedback checks the pick and still requires the follow-up', async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem(
				'coding-drills:v1:preferences',
				JSON.stringify({ sound: false, haptics: false, immediateFeedback: true, theme: 'dark' })
			);
		});
		await page.goto(DECK_URL);
		await expect(page.getByRole('button', { name: 'Check', exact: true })).toHaveCount(0);
		const question = await currentQuestion(page);
		const wrong = plainText(optionOf(question, firstWrongId(question)).text, 1000);
		await page.getByRole('radio', { name: wrong, exact: true }).check();
		await expect(page.getByRole('heading', { name: 'Not quite.' })).toBeVisible();
		await continueButton(page).click();
		await expect(page.getByText('Follow-up', { exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Check', exact: true })).toHaveCount(0);
	});

	for (const theme of ['light', 'dark'] as const) {
		test(`${theme} theme passes the axe scans`, async ({ page }) => {
			await page.addInitScript((choice) => {
				localStorage.setItem(
					'coding-drills:v1:preferences',
					JSON.stringify({ sound: false, haptics: false, immediateFeedback: false, theme: choice })
				);
			}, theme);

			await page.goto('/');
			await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
			await expectNoViolations(page);

			await page.goto('/progress');
			await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();
			await expectNoViolations(page);

			await page.goto('/flags');
			await expect(page.getByRole('heading', { name: 'Flagged questions' })).toBeVisible();
			await expectNoViolations(page);

			await page.goto('/settings');
			await expect(page.getByRole('switch', { name: 'Sound effects' })).toBeVisible();
			await expectNoViolations(page);
			await page.getByRole('switch', { name: 'Immediate feedback on quizzes' }).click();
			await expect(page.getByRole('dialog', { name: 'Immediate feedback is on' })).toBeVisible();
			await expectNoViolations(page);

			await page.goto(DECK_URL);
			const question = await currentQuestion(page);
			await answerMain(page, question, firstWrongId(question));
			await expect(page.getByRole('heading', { name: 'Not quite.' })).toBeVisible();
			await expectNoViolations(page);
		});
	}
});
