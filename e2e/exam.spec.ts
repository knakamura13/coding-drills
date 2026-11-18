import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { loadCurriculum } from '../src/lib/content/loadCurriculum.ts';
import { addDays, localDay } from '../src/lib/domain/days.ts';
import { answerCorrectly, answerMain, continueButton, continuePastWrong, currentQuestionAny, firstWrongId } from './helpers';
import { seed } from './seed';

const curriculum = loadCurriculum('content/curriculum', 'content/decks');
const PATH = 'arrays-and-strings';
const CHECKPOINT = curriculum.branches.flatMap((branch) => branch.paths).find((path) => path.id === PATH)!.checkpoints[0]!;
const teaching = curriculum.drills.filter((drill) => drill.pathId === PATH && (drill.disposition === 'keep' || drill.disposition === 'rewrite'));
const exam = curriculum.drills.filter((drill) => drill.pathId === PATH && drill.disposition === 'exam');

function attempts(drills: typeof teaching, correct: boolean[] | true, daysAgo = 3) {
	const day = addDays(localDay(new Date()), -daysAgo);
	return drills.map((drill, index) => ({
		id: `seed-${drill.questionId}-${daysAgo}`,
		at: `${day}T12:00:00.000Z`,
		day,
		deckId: drill.deckId,
		questionId: drill.questionId,
		pickedId: 'seeded',
		correct: correct === true ? true : correct[index]!
	}));
}

const masteredPath = () => attempts(teaching, true, 5);

async function openCheckpoint(page: Page) {
	await page.goto('/tree');
	const node = page.getByRole('button', { name: new RegExp(CHECKPOINT.title) });
	await node.click();
	return page.locator(`#detail-${CHECKPOINT.id}`);
}

test.describe('checkpoint exam', () => {
	test('a locked checkpoint sends the learner back to the tree', async ({ page }) => {
		await page.goto(`/exam/${CHECKPOINT.id}`);
		await expect(page).toHaveURL(/\/tree$/);
	});

	test('an unknown checkpoint shows the not-found page', async ({ page }) => {
		await page.goto('/exam/not-a-checkpoint');
		await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible();
	});

	test('once its skills are mastered the tree offers the exam, and sitting it right passes it', async ({ page }) => {
		await seed(page, masteredPath());
		const detail = await openCheckpoint(page);
		await expect(detail).toContainText('Every skill that leads here is mastered');
		await detail.getByRole('link', { name: 'Start the exam' }).click();
		await expect(page).toHaveURL(`/exam/${CHECKPOINT.id}`);
		await expect(page.getByRole('heading', { level: 1, name: `Checkpoint: ${CHECKPOINT.title}` })).toBeVisible();

		const seen = new Set<string>();
		for (let item = 0; item < exam.length; item++) {
			const { question } = await currentQuestionAny(page);
			seen.add(question.id);
			await answerCorrectly(page, question);
			await continueButton(page).click();
		}
		expect([...seen].sort()).toEqual(exam.map((drill) => drill.questionId).sort());
		await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();

		const reopened = await openCheckpoint(page);
		await expect(reopened).toContainText('Passed');
		await expect(reopened.getByRole('link', { name: 'Sit it again' })).toBeVisible();
	});

	test('a sitting with too many first-try misses leaves the exam available', async ({ page }) => {
		const missed = attempts(exam, exam.map((_, index) => index > 1));
		await seed(page, [...masteredPath(), ...missed]);
		const detail = await openCheckpoint(page);
		await expect(detail.getByRole('link', { name: 'Start the exam' })).toBeVisible();
	});

	test('a passed exam stays passed when a skill is later missed', async ({ page }) => {
		const day = (daysAgo: number) => addDays(localDay(new Date()), -daysAgo);
		const miss = { ...attempts(teaching.slice(0, 1), [false], 0)[0]!, id: 'later-miss', day: day(0) };
		await seed(page, [...masteredPath(), ...attempts(exam, true, 2), miss]);
		const detail = await openCheckpoint(page);
		await expect(detail).toContainText('Passed');
	});

	test('the path after a checkpoint stays locked until that checkpoint is passed', async ({ page }) => {
		// Mastering every skill of Arrays and strings is not enough to open Pointer scans.
		await seed(page, masteredPath());
		await page.goto('/tree');
		await page.locator('#skill-choose-moving-end').getByRole('button').click();
		const detail = page.locator('#detail-choose-moving-end');
		await expect(detail).toContainText('Locked until the checkpoint is passed on Arrays and strings');
		await expect(detail.getByRole('link', { name: /^Practice in/ })).toHaveCount(0);
	});

	test('passing the checkpoint opens the next path', async ({ page }) => {
		await seed(page, [...masteredPath(), ...attempts(exam, true, 2)]);
		await page.goto('/tree');
		await page.locator('#skill-choose-moving-end').getByRole('button').click();
		const detail = page.locator('#detail-choose-moving-end');
		await expect(detail).not.toContainText('Locked until');
		await expect(detail.getByRole('link', { name: /^Practice in/ }).first()).toBeVisible();
	});

	test('a later miss drops a mastered skill back to practicing in the tree', async ({ page }) => {
		const drill = teaching.find((item) => item.skillId)!;
		const miss = { ...attempts([drill], [false], 0)[0]!, id: 'decay-miss' };
		await seed(page, [...masteredPath(), miss]);
		await page.goto('/tree');
		await expect(page.locator(`#skill-${drill.skillId}`)).toContainText('Practicing');
	});

	test('a failed sitting says what to review, and the review leads back to the exam', async ({ page }) => {
		await seed(page, masteredPath());
		await page.goto(`/exam/${CHECKPOINT.id}`);
		for (let item = 0; item < exam.length; item++) {
			const { question } = await currentQuestionAny(page);
			if (item < 2) {
				// Two misses are one too many.
				await answerMain(page, question, firstWrongId(question));
				await continuePastWrong(page);
				await page.getByText('Follow-up', { exact: true }).waitFor();
				await page.getByRole('radio').first().check();
				await page.getByRole('button', { name: 'Check', exact: true }).click();
				await continueButton(page).click();
			} else {
				await answerCorrectly(page, question);
				await continueButton(page).click();
			}
		}
		await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();
		const outcome = page.getByRole('region', { name: 'Not passed yet' });
		await expect(outcome).toContainText('first.');
		await expect(outcome).toContainText('another day');
		const results = await new AxeBuilder({ page }).analyze();
		expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target).join(', ')}`)).toEqual([]);

		await outcome.getByRole('link', { name: 'Review these skills' }).click();
		await expect(page).toHaveURL(new RegExp(`/exam/${CHECKPOINT.id}/review`));
		await expect(page.getByRole('heading', { level: 1, name: /Review for the checkpoint/ })).toBeVisible();
		await currentQuestionAny(page);

		// The tree still offers the exam: a failed sitting does not lock it.
		const detail = await openCheckpoint(page);
		await expect(detail.getByRole('link', { name: 'Start the exam' })).toBeVisible();
	});

	test('a review with no usable skills falls back to the whole path, and an unknown checkpoint is not found', async ({ page }) => {
		await seed(page, masteredPath());
		await page.goto(`/exam/${CHECKPOINT.id}/review?skills=nonsense`);
		await currentQuestionAny(page);
		await page.goto('/exam/not-a-checkpoint/review');
		await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible();
	});

	test('a skill with drills due shows how many, and its review sitting holds only that skill', async ({ page }) => {
		const drill = teaching.find((item) => item.skillId)!;
		await seed(page, attempts(teaching, true, 10));
		await page.goto('/tree');
		await page.locator(`#skill-${drill.skillId}`).getByRole('button').click();
		const detail = page.locator(`#detail-${drill.skillId}`);
		await expect(detail).toContainText('due for review today');
		await detail.getByRole('link', { name: 'Review this skill' }).click();
		await expect(page).toHaveURL(new RegExp(`/review\\?skill=${drill.skillId}`));
		await expect(page.getByText('due today on this skill')).toBeVisible();
		await currentQuestionAny(page);
	});

	test('a review limited to an unknown skill shows the usual queue', async ({ page }) => {
		await seed(page, attempts(teaching, true, 10));
		await page.goto('/review?skill=nonsense');
		await expect(page.getByText('Questions due today, most overdue first')).toBeVisible();
	});

	test('the exam page has no accessibility violations', async ({ page }) => {
		await seed(page, masteredPath());
		await page.goto(`/exam/${CHECKPOINT.id}`);
		await currentQuestionAny(page);
		const results = await new AxeBuilder({ page }).analyze();
		expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target).join(', ')}`)).toEqual([]);
	});
});
