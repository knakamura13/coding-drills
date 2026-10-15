import { expect, test } from '@playwright/test';
import {
	DECK_URL,
	answerFollowUp,
	answerMain,
	continueButton,
	continuePastWrong,
	currentQuestion,
	deck,
	firstWrongId,
	openMenu,
	optionOf,
	playDeck
} from './helpers';
import { plainText } from '../src/lib/markdown/render.ts';

const text = (markdown: string) => plainText(markdown, 1000);

test.describe('the lesson loop', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(DECK_URL);
	});

	test('starts from the decks page', async ({ page }) => {
		await page.goto('/decks');
		await expect(page.getByRole('heading', { name: 'Decks', level: 1 })).toBeVisible();
		await page.locator(`a[href="/play/${deck.id}"]`).click();
		await expect(page).toHaveURL(DECK_URL);
		await expect(page.getByRole('progressbar', { name: 'Lesson progress' })).toHaveAttribute(
			'aria-valuenow',
			'0'
		);
		// Question order is shuffled, so read which question came up.
		const first = await currentQuestion(page);
		await expect(page.getByRole('heading', { level: 2 })).toHaveText(first.heading ?? deck.heading!);
	});

	test('a correct answer explains itself inline and skips the follow-up', async ({ page }) => {
		const question = await currentQuestion(page);
		await answerMain(page, question, question.correct);

		const sheet = page.getByRole('region', { name: 'Answer feedback' });
		await expect(sheet.getByRole('heading', { name: 'Well done!' })).toBeVisible();
		await expect(sheet).toContainText(text(optionOf(question, question.correct).explanation).slice(0, 40));
		await expect(sheet.getByRole('button', { name: 'See why again' })).toHaveCount(0);

		await continueButton(page).click();
		await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20');
		await expect(page.getByText('Follow-up', { exact: true })).toHaveCount(0);
	});

	test('a wrong answer opens Why?, then See why again, then its own follow-up', async ({ page }) => {
		const question = await currentQuestion(page);
		const wrongId = firstWrongId(question);
		const wrong = optionOf(question, wrongId);
		await answerMain(page, question, wrongId);

		const sheet = page.getByRole('region', { name: 'Answer feedback' });
		await expect(sheet.getByRole('heading', { name: 'Not quite.' })).toBeVisible();
		await expect(sheet).toContainText('The correct answer:');
		await expect(sheet).toContainText(text(optionOf(question, question.correct).text));
		await expect(sheet).not.toContainText(text(wrong.explanation).slice(0, 40));
		await expect(sheet.getByRole('button', { name: 'Why?', exact: true })).toBeFocused();
		await expect(sheet.getByRole('button', { name: 'Continue', exact: true })).toHaveCount(0);
		await expect(sheet.getByRole('button', { name: 'See why again' })).toHaveCount(0);

		await page.keyboard.press('Enter');
		const why = page.getByRole('dialog', { name: 'Why the answers differ' });
		await expect(why).toContainText('You picked');
		await expect(why).toContainText(text(wrong.text));
		await expect(why).toContainText(text(wrong.explanation).slice(0, 40));
		await expect(why).toContainText('Correct answer');
		await expect(why).toContainText(text(optionOf(question, question.correct).explanation).slice(0, 40));
		await expect(why.getByRole('button', { name: 'Flag this question' })).toHaveCount(0);
		await why.getByRole('button', { name: 'Got it' }).click();
		await expect(why).toBeHidden();

		await expect(sheet.getByRole('button', { name: 'See why again' })).toBeVisible();
		await continueButton(page).click();
		await expect(page.getByText('Follow-up', { exact: true })).toBeVisible();
		await expect(page.getByRole('region', { name: 'Problem' })).toContainText(text(question.prompt).slice(0, 30));
		await expect(page.getByRole('heading', { level: 2 })).toHaveText(text(question.followUps[wrongId].prompt));
		await expect(page.getByRole('button', { name: 'Check', exact: true })).toBeDisabled();
	});

	test('each wrong option leads to a different follow-up', async ({ page }) => {
		const question = await currentQuestion(page);
		const prompts = new Set<string>();
		for (const option of question.options.filter((candidate) => candidate.id !== question.correct)) {
			await page.goto(DECK_URL);
			// The shuffled order differs per load, so look up the same question again.
			let current = await currentQuestion(page);
			while (current.id !== question.id) {
				await answerMain(page, current, current.correct);
				await continueButton(page).click();
				current = await currentQuestion(page);
			}
			await answerMain(page, question, option.id);
			await continuePastWrong(page);
			prompts.add((await page.getByRole('heading', { level: 2 }).innerText()).trim());
		}
		expect(prompts.size).toBe(question.options.length - 1);
	});

	test('a right follow-up praises and explains, then moves on', async ({ page }) => {
		const question = await currentQuestion(page);
		const wrongId = firstWrongId(question);
		await answerMain(page, question, wrongId);
		await continuePastWrong(page);
		await answerFollowUp(page, question, wrongId, true);

		const sheet = page.getByRole('region', { name: 'Answer feedback' });
		await expect(sheet.getByRole('heading', { name: 'Well done!' })).toBeVisible();
		await expect(sheet).toContainText(text(question.followUps[wrongId].explanation).slice(0, 40));
		await continueButton(page).click();
		await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20');
	});

	test('a wrong follow-up shows the answer and explanation, with no further follow-up', async ({ page }) => {
		const question = await currentQuestion(page);
		const wrongId = firstWrongId(question);
		const followUp = question.followUps[wrongId];
		await answerMain(page, question, wrongId);
		await continuePastWrong(page);
		await answerFollowUp(page, question, wrongId, false);

		const sheet = page.getByRole('region', { name: 'Answer feedback' });
		await expect(sheet.getByRole('heading', { name: 'Not quite.' })).toBeVisible();
		const right = followUp.options.find((option) => option.id === followUp.correct)!;
		await expect(sheet).toContainText(text(right.text));
		await expect(sheet).toContainText(text(followUp.explanation).slice(0, 40));
		await expect(sheet.getByRole('button', { name: 'See why again' })).toHaveCount(0);

		await continueButton(page).click();
		await expect(page.getByText('Follow-up', { exact: true })).toHaveCount(0);
		await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20');
	});

	test('finishing shows the summary and records every attempt', async ({ page }) => {
		// Q1 wrong then follow-up right, Q2 wrong then follow-up wrong, the rest right.
		await playDeck(page, (question, index) => {
			if (index === 0) return { main: firstWrongId(question), followUpRight: true };
			if (index === 1) return { main: firstWrongId(question), followUpRight: false };
			return { main: 'right' };
		});

		await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();
		await expect(page.getByText(`${deck.questions.length - 2} of ${deck.questions.length} right on the first try`)).toBeVisible();
		await expect(page.getByText('1 of 2 follow-ups right')).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Missed' })).toBeVisible();
		await expect(page.locator('.miss')).toHaveCount(2);

		const attempts = await page.evaluate(() =>
			JSON.parse(localStorage.getItem('coding-drills:v1:attempts') ?? '[]')
		);
		expect(attempts).toHaveLength(deck.questions.length);
		expect(attempts.filter((attempt: { correct: boolean }) => !attempt.correct)).toHaveLength(2);
		for (const attempt of attempts) {
			expect(attempt.deckId).toBe(deck.id);
			expect(Boolean(attempt.followUp)).toBe(!attempt.correct);
		}
	});

	test('Take it again restarts the lesson', async ({ page }) => {
		await playDeck(page, () => ({ main: 'right' }));
		await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();
		await expect(page.getByText('No misses')).toBeVisible();
		await page.getByRole('button', { name: 'Take it again' }).click();
		await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
		await expect(page.getByRole('radio').first()).toBeVisible();
	});
});

test.describe('flagging', () => {
	test('saves a flag, links it to a GitHub issue on the summary, and lists it on /flags', async ({ page }) => {
		await page.goto(DECK_URL);
		const question = await currentQuestion(page);
		await answerMain(page, question, question.correct);
		await page.getByRole('button', { name: 'Flag this question' }).click();

		const dialog = page.getByRole('dialog', { name: 'Flag this question' });
		await expect(dialog).toContainText('The main question');
		await dialog.getByLabel('What looks wrong?').fill('The explanation overclaims.');
		await dialog.getByRole('button', { name: 'Save flag' }).click();
		await expect(dialog).toBeHidden();

		await continueButton(page).click();
		await playDeck(page, () => ({ main: 'right' }), 1);

		await expect(page.getByRole('heading', { name: 'Flagged' })).toBeVisible();
		const link = page.getByRole('link', { name: 'Open as GitHub issue' });
		const href = (await link.getAttribute('href'))!;
		const url = new URL(href);
		expect(url.origin + url.pathname).toBe('https://github.com/knakamura13/coding-drills/issues/new');
		expect(url.searchParams.get('title')).toContain(question.id);
		expect(url.searchParams.get('body')).toContain('The explanation overclaims.');
		await expect(link).toHaveAttribute('target', '_blank');
		await expect(link).toHaveAttribute('rel', /noopener/);

		await page.goto('/flags');
		await expect(page.getByRole('heading', { name: 'Flagged questions' })).toBeVisible();
		await expect(page.getByText('The explanation overclaims.')).toBeVisible();
		await page.getByRole('button', { name: 'Remove' }).click();
		await expect(page.getByText('Nothing flagged.')).toBeVisible();
	});

	test('a follow-up can be flagged separately and the home screen counts flags', async ({ page }) => {
		await page.goto(DECK_URL);
		const question = await currentQuestion(page);
		const wrongId = firstWrongId(question);
		await answerMain(page, question, wrongId);
		await continuePastWrong(page);
		await answerFollowUp(page, question, wrongId, true);
		await page.getByRole('button', { name: 'Flag this question' }).click();
		const dialog = page.getByRole('dialog', { name: 'Flag this question' });
		await expect(dialog).toContainText('The follow-up shown after picking');
		await dialog.getByRole('button', { name: 'Save flag' }).click();

		await page.goto('/');
		await openMenu(page);
		await expect(page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: /Flagged questions\s*1/ })).toBeVisible();
	});
});

test.describe('leaving and keyboard use', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(DECK_URL);
	});

	test('closing before answering leaves without a prompt', async ({ page }) => {
		await page.getByRole('button', { name: 'Quit lesson' }).click();
		await expect(page).toHaveURL('/');
	});

	test('closing mid-lesson asks first, and Keep going stays put', async ({ page }) => {
		const question = await currentQuestion(page);
		await answerMain(page, question, question.correct);
		await continueButton(page).click();

		await page.getByRole('button', { name: 'Quit lesson' }).click();
		const dialog = page.getByRole('dialog', { name: 'End this session?' });
		await expect(dialog).toBeVisible();
		await dialog.getByRole('button', { name: 'Keep going' }).click();
		await expect(dialog).toBeHidden();
		await expect(page).toHaveURL(DECK_URL);

		await page.getByRole('button', { name: 'Quit lesson' }).click();
		await dialog.getByRole('button', { name: 'End session' }).click();
		await expect(page).toHaveURL('/');
	});

	test('number keys pick an option and Enter checks, then continues', async ({ page }) => {
		const question = await currentQuestion(page);
		const labels = await page.locator('fieldset label').allInnerTexts();
		const index = labels.findIndex((label) => label.trim() === text(optionOf(question, question.correct).text));
		await page.keyboard.press(String(index + 1));
		await expect(page.getByRole('radio', { checked: true })).toHaveCount(1);
		await page.keyboard.press('Enter');
		await expect(page.getByRole('heading', { name: 'Well done!' })).toBeVisible();
		await page.keyboard.press('Enter');
		await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20');
	});

	test('the Check button stays disabled until an option is picked', async ({ page }) => {
		const check = page.getByRole('button', { name: 'Check', exact: true });
		await expect(check).toBeDisabled();
		await page.getByRole('radio').first().check();
		await expect(check).toBeEnabled();
	});

	test('an unknown deck shows the not-found page', async ({ page }) => {
		await page.goto('/play/does-not-exist');
		await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible();
		await page.getByRole('link', { name: 'Home' }).click();
		await expect(page).toHaveURL('/');
	});
});
