import { expect, test, type Page } from '@playwright/test';
import type { Depth } from '../src/lib/content/depth.ts';
import { loadCurriculum } from '../src/lib/content/loadCurriculum.ts';
import { addDays, localDay } from '../src/lib/domain/days.ts';
import { PREFERENCES_KEY } from '../src/lib/preferences/preferences.ts';
import { answerCorrectly, continueButton, currentQuestionAny, openMenu } from './helpers';
import { answerRight, decks, onScreen, seenEveryDeck, summaryHeading } from './learn-helpers';
import { seed } from './seed';

// The depth setting (#155). Until the Settings control ships, the level comes from localStorage only.

const curriculum = loadCurriculum('content/curriculum', 'content/decks');
const WEIGHTED = 'cheapest-within-stops';
const BITS = 'trace-and-choose-bits';

async function atLevel(page: Page, depth: Depth) {
	await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [PREFERENCES_KEY, JSON.stringify({ depth })] as const);
}

type Drill = (typeof curriculum.drills)[number];

function rightOn(drills: readonly Drill[], daysAgo: number) {
	const day = addDays(localDay(new Date()), -daysAgo);
	return drills.map((drill) => ({
		id: `depth-${drill.questionId}-${daysAgo}`,
		at: `${day}T12:00:00.000Z`,
		day,
		deckId: drill.deckId,
		questionId: drill.questionId,
		pickedId: 'seeded',
		correct: true
	}));
}

const teaching = curriculum.drills.filter((drill) => drill.disposition === 'keep' || drill.disposition === 'rewrite');
/** Every interview teaching drill answered right: every skill the interview level shows is mastered there. */
const interviewMastered = () => rightOn(teaching.filter((drill) => drill.depth === 'interview'), 5);
const weightedExam = curriculum.drills.filter((drill) => drill.pathId === 'weighted-paths' && drill.disposition === 'exam');
const checkpointNode = (page: Page, id: string) => page.locator(`#checkpoint-${id}`);
const deckRow = (page: Page, title: string) =>
	page.getByRole('region', { name: 'Decks' }).getByRole('listitem').filter({ has: page.getByText(title, { exact: true }) });

/** A deep question in a mixed deck, and that deck's interview question count. */
const deepDrill = curriculum.drills.find((drill) => drill.deckId === 'weighted-paths' && drill.depth === 'deep' && drill.disposition !== 'retire')!;
const weightedDeck = decks.find((deck) => deck.id === 'weighted-paths')!;
const weightedInterviewCount = new Set(
	curriculum.drills.filter((drill) => drill.deckId === 'weighted-paths' && drill.depth === 'interview').map((drill) => drill.questionId)
).size;

const deepIds = new Set(curriculum.drills.filter((drill) => drill.depth === 'deep').map((drill) => drill.questionId));
/** Decks with at least one question the Interview level shows. */
const interviewDeckCount = decks.filter((deck) => deck.questions.some((question) => !deepIds.has(question.id))).length;

/** `deepDrill` missed `daysAgo` days ago, so it is due for review today. */
function missedDeep(daysAgo: number) {
	const day = addDays(localDay(new Date()), -daysAgo);
	return [
		{
			id: `depth-missed-${deepDrill.questionId}`,
			at: `${day}T12:00:00.000Z`,
			day,
			deckId: deepDrill.deckId,
			questionId: deepDrill.questionId,
			pickedId: 'seeded',
			correct: false,
			followUp: { pickedId: 'seeded', correct: false }
		}
	];
}

test.describe('at the Interview level', () => {
	test.beforeEach(async ({ page }) => atLevel(page, 'interview'));

	test('the tree hides the deep paths, and Weighted paths opens without the Dijkstra fork', async ({ page }) => {
		await seed(page, interviewMastered());
		await page.goto('/tree');
		await expect(checkpointNode(page, WEIGHTED)).toContainText('Available');
		await expect(page.locator('#path-bit-manipulation')).toHaveCount(0);
		await expect(page.locator('#skill-finalize-distance')).toHaveCount(0);
		await expect(page.locator('#path-weighted-paths')).toBeVisible();
	});

	test('a lesson plays only the interview questions of a mixed deck', async ({ page }) => {
		await seenEveryDeck(page);
		const ids = new Set(curriculum.drills.filter((drill) => drill.deckId === 'weighted-paths' && drill.depth === 'interview').map((drill) => drill.questionId));
		const pool = decks.find((deck) => deck.id === 'weighted-paths')!.questions.filter((question) => ids.has(question.id));
		expect(pool.length).toBeLessThan(decks.find((deck) => deck.id === 'weighted-paths')!.questions.length);
		await page.goto('/play/weighted-paths');
		const seen = new Set<string>();
		for (let step = 0; step < pool.length; step++) {
			// onScreen throws on a question outside the pool, so a deep question fails here.
			const question = await onScreen(page, pool);
			seen.add(question.id);
			await answerRight(page, question);
		}
		await expect(summaryHeading(page)).toBeVisible();
		expect([...seen].sort()).toEqual([...ids].sort());
	});

	test('a checkpoint on a deep path sends the learner back to the tree', async ({ page }) => {
		await seed(page, rightOn(teaching.filter((drill) => drill.pathId === 'bit-manipulation'), 5));
		await page.goto(`/exam/${BITS}`);
		await expect(page).toHaveURL(/\/tree$/);
	});

	test('an exam draws only interview items, and four right pass it', async ({ page }) => {
		await seed(page, interviewMastered());
		await page.goto(`/exam/${WEIGHTED}`);
		await expect(page.getByText(/^A sitting is 4 exam items\./)).toBeVisible();
		const interviewIds = weightedExam.filter((drill) => drill.depth === 'interview').map((drill) => drill.questionId);
		const seen: string[] = [];
		for (let item = 0; item < interviewIds.length; item++) {
			const { question } = await currentQuestionAny(page);
			seen.push(question.id);
			await answerCorrectly(page, question);
			await continueButton(page).click();
		}
		await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();
		expect(seen.sort()).toEqual([...interviewIds].sort());
		await expect(page.getByRole('region', { name: 'Checkpoint passed' })).toBeVisible();
	});

	test('the review for a checkpoint on a deep path sends the learner back to the tree', async ({ page }) => {
		await page.goto(`/exam/${BITS}/review`);
		await expect(page).toHaveURL(/\/tree$/);
	});

	test('the deck list hides the deep decks, and a mixed deck counts only its interview questions', async ({ page }) => {
		expect(weightedInterviewCount).toBeLessThan(weightedDeck.questions.length);
		await page.goto('/decks');
		// Prerendered at the default level, then filtered once the page has mounted.
		await expect(page.locator('a[href="/play/bit-manipulation"]')).toHaveCount(0);
		await expect(page.locator('a[href="/play/weighted-paths"]')).toContainText(`0 of ${weightedInterviewCount} learned`);
	});

	test('a deep question that is due is not offered for review', async ({ page }) => {
		await seed(page, missedDeep(3));
		await page.goto('/review');
		// Nothing else is due, so the review sends the learner home.
		await expect(page).toHaveURL(/\/$/);
	});

	test('a deep question missed before is not offered as a weak spot', async ({ page }) => {
		await seed(page, missedDeep(3));
		await page.goto('/weak');
		await expect(page).toHaveURL(/\/$/);
	});

	test('the home screen and the menu count only the decks the level shows', async ({ page }) => {
		expect(interviewDeckCount).toBeLessThan(decks.length);
		await page.goto('/');
		await expect(page.getByRole('link', { name: `Browse all ${interviewDeckCount} decks` })).toBeVisible();
		await openMenu(page);
		await expect(page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: /^All decks/ })).toContainText(String(interviewDeckCount));
	});

	test('progress counts only interview questions per deck, but every answer in the streak', async ({ page }) => {
		// The deep question answered right on each of the last three days: learned at Deep, and a 3-day streak.
		await seed(page, [2, 1, 0].flatMap((daysAgo) => rightOn([deepDrill], daysAgo)));
		await page.goto('/progress');
		await expect(page.locator('.stat').filter({ hasText: 'day streak' }).locator('.value')).toHaveText('3');
		await expect(deckRow(page, weightedDeck.title)).toContainText(`0 of ${weightedInterviewCount} learned`);
		await expect(deckRow(page, 'Bit manipulation')).toHaveCount(0);
	});

	test('a full sitting from the Deep level counts as passed', async ({ page }) => {
		// Three interview items and two deep ones: the interview pool alone holds only three of them.
		const interviewItems = weightedExam.filter((drill) => drill.depth === 'interview').slice(0, 3);
		const deepItems = weightedExam.filter((drill) => drill.depth === 'deep').slice(0, 2);
		await seed(page, rightOn([...interviewItems, ...deepItems], 2));
		await page.goto('/tree');
		await expect(checkpointNode(page, WEIGHTED)).toContainText('Passed');
	});
});

test.describe('at the Deep level', () => {
	test.beforeEach(async ({ page }) => atLevel(page, 'deep'));

	test('the tree shows the deep paths, and Weighted paths waits on the Dijkstra fork', async ({ page }) => {
		await seed(page, interviewMastered());
		await page.goto('/tree');
		const node = checkpointNode(page, WEIGHTED);
		await expect(node).toContainText('Locked');
		await expect(node).toContainText('Decide when a tentative distance can be finalized');
		await expect(page.locator('#path-bit-manipulation')).toBeVisible();
		await expect(page.locator('#skill-finalize-distance')).toBeVisible();
	});

	test('the exam on a deep path opens once its skills are mastered', async ({ page }) => {
		await seed(page, rightOn(teaching.filter((drill) => drill.pathId === 'bit-manipulation'), 5));
		await page.goto(`/exam/${BITS}`);
		await expect(page).toHaveURL(new RegExp(`/exam/${BITS}$`));
		await expect(page.getByRole('heading', { level: 1, name: /^Checkpoint:/ })).toBeVisible();
	});

	test('a deep question that is due is offered for review', async ({ page }) => {
		await seed(page, missedDeep(3));
		await page.goto('/review');
		await expect(page).toHaveURL(/\/review$/);
		const { question } = await currentQuestionAny(page);
		expect(question.id).toBe(deepDrill.questionId);
	});

	test('progress counts the deep questions per deck', async ({ page }) => {
		await seed(page, [2, 1, 0].flatMap((daysAgo) => rightOn([deepDrill], daysAgo)));
		await page.goto('/progress');
		await expect(deckRow(page, weightedDeck.title)).toContainText(`1 of ${weightedDeck.questions.length} learned`);
	});

	test('a 4-item sitting from the Interview level counts as passed', async ({ page }) => {
		const interviewItems = weightedExam.filter((drill) => drill.depth === 'interview');
		expect(interviewItems).toHaveLength(4);
		await seed(page, rightOn(interviewItems, 2));
		await page.goto('/tree');
		await expect(checkpointNode(page, WEIGHTED)).toContainText('Passed');
	});
});

// The interim default (#155). Flipping DEFAULT_LEVEL to Interview changes what this expects.
test('with no level saved the tree is the Deep one', async ({ page }) => {
	await seed(page, interviewMastered());
	await page.goto('/tree');
	await expect(checkpointNode(page, WEIGHTED)).toContainText('Locked');
	await expect(page.locator('#path-bit-manipulation')).toBeVisible();
});
