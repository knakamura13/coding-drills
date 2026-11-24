import { expect, test, type Page } from '@playwright/test';
import { isChoiceQuestion, type TapCellQuestion } from '../src/lib/content/schema.ts';
import { cellLabel } from '../src/lib/domain/tap.ts';
import { plainText } from '../src/lib/markdown/render.ts';
import { PREFERENCES_KEY } from '../src/lib/preferences/preferences.ts';
import {
	URL,
	answerRight,
	answerWrong,
	cell,
	cellQuestions,
	cellsDeck,
	deck,
	decks,
	firstChoice,
	labelledCells,
	onScreen,
	optionLabel,
	panel,
	pick,
	questions,
	primary,
	runs,
	shown,
	violations
} from './learn-helpers.ts';

// The new lesson screen on /learn/<deck>: multiple-choice and tap-the-cell questions on the
// FigCraft design. Drag-pointers and step-trace questions are left out until they land.

test.beforeEach(async ({ page }) => {
	await page.goto(URL);
	await expect(page.getByRole('radio').first()).toBeVisible();
});

test('opens on the new screen: deck title, no counter, Check waits for a pick', async ({ page }) => {
	await expect(page.getByRole('banner').getByText(deck.title)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Menu' })).toHaveCount(0);
	const progress = page.getByRole('progressbar', { name: 'Lesson progress' });
	await expect(progress).toHaveAttribute('aria-valuenow', '0');
	await expect(progress).toHaveAttribute('aria-valuemax', String(shown.length));
	await expect(primary(page)).toHaveText('Check');
	await expect(primary(page)).toBeDisabled();
	expect(await page.evaluate(() => document.documentElement.dataset.branch)).toBe('sequences-and-search');
	expect(await violations(page)).toEqual([]);
});

test('a right answer: the tile shows it, Continue moves on and focus goes to the next heading', async ({ page }) => {
	const question = await firstChoice(page);
	await pick(page, optionLabel(question, question.correct));
	await expect(primary(page)).toBeEnabled();
	await primary(page).click();
	await expect(panel(page)).toHaveAccessibleName('Correct');
	await expect(primary(page)).toHaveText('Continue');
	await expect(primary(page)).toBeFocused();
	await expect(page.getByText(', the right answer')).toHaveCount(1);
	const right = question.options.find((option) => option.id === question.correct)!;
	await expect(page.getByRole('status')).toHaveText(`Correct. ${plainText(right.explanation, 1000)}`);
	await expect(page.getByRole('radio').first()).toBeDisabled();
	expect(await violations(page)).toEqual([]);
	await primary(page).click();
	await expect(page.getByRole('progressbar', { name: 'Lesson progress' })).toHaveAttribute('aria-valuenow', '1');
	await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
});

test('a wrong answer: rose pick, right answer marked, then its follow-up', async ({ page }) => {
	const question = await firstChoice(page);
	const wrong = question.options.find((option) => option.id !== question.correct)!;
	await pick(page, plainText(wrong.text, 1000));
	await primary(page).click();
	await expect(page.getByText(', your answer, not right')).toHaveCount(1);
	await expect(page.getByText(', the right answer')).toHaveCount(1);
	await expect(panel(page)).toHaveAccessibleName('Not quite');
	// The panel explains the pick itself and does not repeat the right answer; speech names it.
	await expect(panel(page)).toContainText(plainText(wrong.explanation, 1000));
	await expect(page.getByRole('status')).toHaveText(
		`Not quite. The right answer: ${optionLabel(question, question.correct)}. ${plainText(wrong.explanation, 1000)}`
	);
	expect(await violations(page)).toEqual([]);
	await primary(page).click();
	await expect(page.getByText('Follow-up', { exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
	// The folded recap names the question and the pick, and opens to show the original prompt.
	const recap = page.locator('details');
	await expect(recap).toContainText(`You picked ${plainText(wrong.text, 1000)}`);
	await expect(recap).not.toHaveAttribute('open');
	await recap.locator('summary').focus();
	await page.keyboard.press('Enter');
	await expect(recap).toHaveAttribute('open', '');
	await expect(primary(page)).toHaveText('Check');
	expect(await violations(page)).toEqual([]);
});

test('answers are a radio group: arrow keys move the pick', async ({ page, browserName }) => {
	test.skip(browserName === 'webkit', 'WebKit does not move radio focus with Tab by default');
	await page.getByRole('radio').first().focus();
	await page.keyboard.press('ArrowDown');
	await expect(page.getByRole('radio').nth(1)).toBeChecked();
	await expect(primary(page)).toBeEnabled();
});

test('quitting before any answer leaves at once; after one it asks first', async ({ page }) => {
	await page.getByRole('button', { name: 'Quit lesson' }).click();
	await expect(page).toHaveURL(/\/$/);

	await page.goto(URL);
	await answerRight(page, await onScreen(page));
	await page.getByRole('button', { name: 'Quit lesson' }).click();
	const sheet = page.getByRole('dialog', { name: 'Quit this lesson?' });
	await expect(sheet).toBeVisible();
	expect(await violations(page)).toEqual([]);
	await sheet.getByRole('button', { name: 'Continue' }).click();
	await expect(sheet).toBeHidden();
	await page.getByRole('button', { name: 'Quit lesson' }).click();
	await sheet.getByRole('button', { name: 'Quit' }).click();
	await expect(page).toHaveURL(/\/$/);
});

test.describe('the summary', () => {
	const misses = (page: Page) => page.getByRole('list', { name: 'Missed questions' });
	const grab = (page: Page) => page.getByRole('button', { name: 'Missed questions' });

	test('all right: the score is the heading, the path leads to this lesson, and there are no misses', async ({ page }) => {
		for (let index = 0; index < shown.length; index++) await answerRight(page, await onScreen(page));
		const heading = page.getByRole('heading', { name: `${shown.length} of ${shown.length} right the first time` });
		await expect(heading).toBeFocused();
		await expect(page.getByRole('banner').getByText('Lesson complete')).toBeVisible();
		await expect(page.getByRole('progressbar')).toHaveCount(0);
		await expect(page.getByRole('img', { name: /^Sequences and search, then Exact search, (mastered|not mastered yet), then Boundary search$/ })).toBeVisible();
		await expect(misses(page)).toHaveCount(0);
		expect(await violations(page)).toEqual([]);
		await page.getByRole('button', { name: 'Retry' }).click();
		await expect(page.getByRole('progressbar', { name: 'Lesson progress' })).toHaveAttribute('aria-valuenow', '0');
	});

	test('a miss lists the pick, the answer and how its follow-up went', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		const first = await firstChoice(page);
		await answerWrong(page, first, false);
		for (let index = 1; index < shown.length; index++) await answerRight(page, await onScreen(page));
		await expect(page.getByRole('heading', { name: `${shown.length - 1} of ${shown.length} right the first time` })).toBeFocused();
		const row = misses(page).getByRole('listitem');
		await expect(row).toHaveCount(1);
		const wrong = first.options.find((option) => option.id !== first.correct)!;
		await expect(row).toContainText(first.heading ?? deck.heading!);
		await expect(row).toContainText(`You picked: ${plainText(wrong.text, 1000)}`);
		await expect(row).toContainText(`The answer: ${optionLabel(first, first.correct)}`);
		await expect(row).toContainText('Follow-up question, missed');
		await expect(grab(page)).toHaveCount(0);
		expect(await violations(page)).toEqual([]);
		await page.getByRole('button', { name: 'Done' }).click();
		await expect(page).toHaveURL(/\/$/);
	});

	test('desktop splits the tree and the misses: every miss in the card, no drawer, buttons side by side', async ({ page, isMobile }) => {
		test.skip(isMobile, 'desktop layout only');
		await page.setViewportSize({ width: 1440, height: 900 });
		for (let index = 0; index < shown.length; index++) await answerWrong(page, await onScreen(page));
		await expect(page.getByRole('heading', { name: `0 of ${shown.length} right the first time` })).toBeFocused();
		await expect(grab(page)).toHaveCount(0);
		await expect(misses(page).getByRole('listitem')).toHaveCount(shown.length);
		const tree = (await page.getByRole('img', { name: /then Boundary search$/ }).boundingBox())!;
		const card = (await page.getByRole('region', { name: 'Missed questions' }).boundingBox())!;
		expect(tree.x).toBe(0);
		expect(card.x).toBeGreaterThan(tree.x + 600);
		const done = (await page.getByRole('button', { name: 'Done' }).boundingBox())!;
		const retry = (await page.getByRole('button', { name: 'Retry' }).boundingBox())!;
		expect(Math.round(done.y)).toBe(Math.round(retry.y));
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
		expect(await violations(page)).toEqual([]);
	});

	test('the tree holds on a real render: edges meet node centers, labels clear nodes, edges, each other and the screen edge, and no box cuts the glow', async ({
		page
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		for (let index = 0; index < shown.length; index++) await answerWrong(page, await onScreen(page));
		const check = () =>
			page.evaluate(() => {
				const problems: string[] = [];
				const svg = document.querySelector<SVGSVGElement>('[role="img"] svg')!;
				const matrix = svg.getScreenCTM()!;
				const toScreen = (x: number, y: number) => new DOMPoint(x, y).matrixTransform(matrix);
				const nodes = [...svg.querySelectorAll<SVGCircleElement>('circle.hollow, circle.filled, circle.ring-base')].map((circle) => {
					const box = circle.getBoundingClientRect();
					return { x: box.x + box.width / 2, y: box.y + box.height / 2, r: box.width / 2 };
				});
				const paths = [...svg.querySelectorAll<SVGPathElement>('path.edge, path.trunk')];
				for (const path of paths) {
					const length = path.getTotalLength();
					const end = path.getPointAtLength(length);
					const endOnScreen = toScreen(end.x, end.y);
					if (!nodes.some((node) => Math.hypot(node.x - endOnScreen.x, node.y - endOnScreen.y) < 1)) problems.push('an edge ends away from every node center');
				}
				const points = paths.flatMap((path) => {
					const length = path.getTotalLength();
					return Array.from({ length: Math.ceil(length / 2) + 1 }, (_, i) => {
						const at = path.getPointAtLength(Math.min(length, i * 2));
						return toScreen(at.x, at.y);
					});
				});
				const labels = [...document.querySelectorAll<HTMLElement>('[role="img"] .label:not(.measure)')].map((label) => ({
					text: label.textContent,
					box: label.getBoundingClientRect()
				}));
				const near = (box: DOMRect, x: number, y: number, r: number) =>
					Math.hypot(x - Math.max(box.left, Math.min(x, box.right)), y - Math.max(box.top, Math.min(y, box.bottom))) < r;
				for (const { text, box } of labels) {
					if (box.left < 8 || box.right > window.innerWidth - 8) problems.push(`${text} is within 8px of the screen edge`);
					if (nodes.some((node) => near(box, node.x, node.y, node.r + 6))) problems.push(`${text} touches a node`);
					if (points.some((point) => near(box, point.x, point.y, 4))) problems.push(`${text} touches an edge`);
					for (const other of labels) {
						if (other.box === box) continue;
						if (box.left < other.box.right && other.box.left < box.right && box.top < other.box.bottom && other.box.top < box.bottom) problems.push(`${text} overlaps ${other.text}`);
					}
				}
				// Decoration may run off the screen, but no box inside the page may cut it: every clipping
				// ancestor smaller than the screen must hold the whole glow.
				const glow = svg.querySelector<SVGCircleElement>('circle[fill^="url"]')!.getBoundingClientRect();
				for (let element = svg.parentElement; element && element !== document.documentElement; element = element.parentElement) {
					const style = getComputedStyle(element);
					// A box with display: contents draws no box, so it clips nothing.
					if (style.display === 'contents' || (style.overflowX === 'visible' && style.overflowY === 'visible')) continue;
					const box = element.getBoundingClientRect();
					const screenSized = box.left <= 0 && box.top <= 0 && box.right >= window.innerWidth && box.bottom >= window.innerHeight;
					if (screenSized) continue;
					const cut =
						(box.top > Math.max(0, glow.top) + 0.5 && 'top') ||
						(box.left > Math.max(0, glow.left) + 0.5 && 'left') ||
						(box.right < Math.min(window.innerWidth, glow.right) - 0.5 && 'right');
					if (cut) problems.push(`the glow is cut at the ${cut} by ${element.tagName.toLowerCase()}.${element.className}`);
				}
				return { problems, labels: labels.length };
			});
		for (const size of [
			{ width: 390, height: 844 },
			{ width: 320, height: 700 }
		]) {
			await page.setViewportSize(size);
			await page.waitForTimeout(200);
			expect(await check()).toEqual({ problems: [], labels: 3 });
		}
		await page.setViewportSize({ width: 390, height: 844 });
		await grab(page).click();
		await page.waitForTimeout(200);
		expect(await check()).toEqual({ problems: [], labels: 3 });
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.waitForTimeout(200);
		expect(await check()).toEqual({ problems: [], labels: 3 });
	});

	test('misses that would scroll become a drawer: tap, Enter and a drag open it, Escape closes it', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		for (let index = 0; index < shown.length; index++) await answerWrong(page, await onScreen(page));
		await expect(page.getByRole('heading', { name: `0 of ${shown.length} right the first time` })).toBeFocused();
		await expect(grab(page)).toHaveAttribute('aria-expanded', 'false');
		const tree = page.getByRole('img', { name: /then Boundary search$/ });
		const curved = (await tree.boundingBox())!.height;

		await grab(page).click();
		await expect(grab(page)).toHaveAttribute('aria-expanded', 'true');
		// Open, the tree lies flat, so it takes far less height (its labels keep room for four lines).
		await expect.poll(async () => (await tree.boundingBox())!.height).toBeLessThan(curved * 0.6);
		expect(await violations(page)).toEqual([]);
		await page.keyboard.press('Escape');
		await expect(grab(page)).toHaveAttribute('aria-expanded', 'false');
		await expect(grab(page)).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(grab(page)).toHaveAttribute('aria-expanded', 'true');
		await grab(page).click();
		await expect(grab(page)).toHaveAttribute('aria-expanded', 'false');

		const box = (await grab(page).boundingBox())!;
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2, box.y - 250, { steps: 8 });
		await page.mouse.up();
		await expect(grab(page)).toHaveAttribute('aria-expanded', 'true');
		await expect(misses(page).getByRole('listitem')).toHaveCount(shown.length);

		// A drag the system cancels snaps back, and the next tap still works.
		await grab(page).click();
		await expect(grab(page)).toHaveAttribute('aria-expanded', 'false');
		await grab(page).evaluate((button) => {
			const at = button.getBoundingClientRect();
			const event = (type: string, y: number) => new PointerEvent(type, { pointerId: 9, clientX: at.x + 10, clientY: y, bubbles: true });
			button.dispatchEvent(event('pointerdown', at.y + 10));
			window.dispatchEvent(event('pointermove', at.y - 120));
			window.dispatchEvent(event('pointercancel', at.y - 120));
		});
		await expect(grab(page)).toHaveAttribute('aria-expanded', 'false');
		await grab(page).click();
		await expect(grab(page)).toHaveAttribute('aria-expanded', 'true');
	});
});

test('desktop keeps the lesson in a 640px column', async ({ page, isMobile }) => {
	test.skip(isMobile, 'desktop layout only');
	const box = await page.locator('main').boundingBox();
	expect(box!.width).toBeLessThanOrEqual(672);
});

test('a deck with no questions the new screen runs yet is not found', async ({ page }) => {
	const none = decks.find((candidate) => !candidate.questions.some(runs));
	test.skip(!none, 'every deck has a question the new screen runs');
	const response = await page.goto(`/learn/${none!.id}`);
	await expect(page.getByText('This deck has no questions the new lesson screen runs yet')).toBeVisible();
	expect(response?.status() ?? 200).toBeLessThan(500);
});

test('a prompt with a code block meets contrast and does not wrap code lines', async ({ page }) => {
	const withCode = questions.filter((question) => question.prompt.includes('```'));
	test.skip(withCode.length === 0, 'no prompt in this deck has a code block');
	for (let index = 0; index < shown.length; index++) {
		const question = await onScreen(page);
		if (isChoiceQuestion(question) && question.prompt.includes('```')) {
			const code = page.getByRole('main').getByLabel('Code');
			await expect(code).toBeVisible();
			// Indentation survives: some line of the snippet starts with spaces on screen.
			const indents = await code
				.locator('.line .text')
				.evaluateAll((lines) => lines.map((line) => (line.textContent ?? '').match(/^ */)![0].length));
			expect(Math.max(...indents)).toBeGreaterThan(0);
			const shown = await code
				.locator('.line .text')
				.first()
				.evaluate((node) => getComputedStyle(node.parentElement!.parentElement!).whiteSpace);
			expect(shown).toBe('pre');
			expect(await violations(page)).toEqual([]);
			return;
		}
		await answerRight(page, question);
	}
	throw new Error('the code block question never came up');
});

test('a deck without headings still gives each question a heading to land on', async ({ page }) => {
	const headingless = decks.find(
		(candidate) =>
			!candidate.heading &&
			candidate.questions.some(isChoiceQuestion) &&
			candidate.questions.filter(runs).every((question) => !question.heading)
	);
	test.skip(!headingless, 'every deck has a heading');
	const own = headingless!.questions.filter(runs);
	await page.goto(`/learn/${headingless!.id}`);
	const h1 = page.getByRole('heading', { level: 1 });
	await expect(h1).toHaveText(`Question 1 of ${own.length}`);
	await page.getByRole('radio').first().check();
	await primary(page).click();
	await primary(page).click();
	await expect(h1).toBeFocused();
	expect(await violations(page)).toEqual([]);
});

test('the feedback panel rises in 150 ms, and only fades with reduced motion', async ({ page }) => {
	for (const motion of ['no-preference', 'reduce'] as const) {
		await page.emulateMedia({ reducedMotion: motion });
		await page.goto(URL);
		const question = await firstChoice(page);
		await pick(page, optionLabel(question, question.correct));
		await primary(page).click();
		const style = await panel(page).evaluate((node) => {
			const css = getComputedStyle(node);
			return { name: css.animationName, duration: css.animationDuration, shift: css.getPropertyValue('--shift').trim() };
		});
		// Svelte scopes keyframe names, so the name ends in "rise".
		expect(style.name).toMatch(/rise$/);
		expect({ duration: style.duration, shift: style.shift }).toEqual({ duration: '0.15s', shift: motion === 'reduce' ? '0' : '1' });
	}
});

test('a long code pick wraps in the recap instead of widening the card', async ({ page }) => {
	const heaps = decks.find((candidate) => candidate.id === 'bounded-heaps-checkpoint')!;
	const pool = heaps.questions.filter(runs);
	await page.goto(`/learn/${heaps.id}`);
	// Right answers skip their follow-ups, so answer right until the question with the long pick.
	for (let step = 0; step < pool.length; step++) {
		const question = await onScreen(page, pool);
		const long = isChoiceQuestion(question) && question.options.find((option) => option.id === 'guard-on-heap');
		if (!long) {
			await answerRight(page, question);
			continue;
		}
		await pick(page, plainText(long.text, 1000));
		await primary(page).click();
		await primary(page).click();
		break;
	}
	const summary = page.locator('details summary');
	await expect(summary).toContainText('You picked');
	const fits = await summary.evaluate((node) => node.scrollWidth <= node.clientWidth);
	expect(fits).toBe(true);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test.describe('the worked example', () => {
	const exampleLink = (page: Page) => page.getByRole('button', { name: 'Walk through a worked example' });
	const sheet = (page: Page) => page.getByRole('dialog', { name: 'Worked example' });

	test('the link under the prompt opens it, and Close and Escape return focus to the link', async ({ page }) => {
		// Every boundary-search question has a worked example.
		const question = await onScreen(page);
		await expect(page.getByRole('main').getByText('Need help?')).toBeVisible();
		await exampleLink(page).click();
		await expect(sheet(page)).toBeVisible();
		await expect(sheet(page)).toContainText(plainText(question.workedExample!, 1000));
		expect(await violations(page)).toEqual([]);
		await sheet(page).getByRole('button', { name: 'Close' }).click();
		await expect(sheet(page)).toBeHidden();
		await expect(exampleLink(page)).toBeFocused();

		await page.keyboard.press('Enter');
		await expect(sheet(page)).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(sheet(page)).toBeHidden();
		await expect(exampleLink(page)).toBeFocused();
	});

	test('the follow-up has no link: its prompt is folded into the recap', async ({ page }) => {
		const question = await firstChoice(page);
		await expect(exampleLink(page)).toBeVisible();
		const wrong = question.options.find((option) => option.id !== question.correct)!;
		await pick(page, plainText(wrong.text, 1000));
		await primary(page).click();
		await primary(page).click();
		await expect(page.getByText('Follow-up', { exact: true })).toBeVisible();
		await expect(exampleLink(page)).toHaveCount(0);
	});

	test('a question without one shows no link', async ({ page }) => {
		expect(cellQuestions.every((question) => !question.workedExample)).toBe(true);
		await page.goto(`/learn/${cellsDeck.id}`);
		await expect(page.getByRole('radio').first()).toBeVisible();
		await expect(page.getByText('Need help?')).toHaveCount(0);
		await expect(exampleLink(page)).toHaveCount(0);
	});

	test('code in an example keeps every line and its spacing', async ({ page }) => {
		const state = decks.find((candidate) => candidate.id === 'search-state')!;
		const pool = state.questions.filter(runs);
		const target = pool.find((question) => question.workedExample?.includes('```'))!;
		const lines = target.workedExample!.split('```python\n')[1]!.split('\n```')[0]!.split('\n');
		await page.goto(`/learn/${state.id}`);
		for (let step = 0; step < pool.length; step++) {
			const question = await onScreen(page, pool);
			if (question.id === target.id) break;
			await answerRight(page, question);
		}
		await exampleLink(page).click();
		const code = sheet(page).getByLabel('Code');
		await expect(code).toBeVisible();
		// innerText follows the CSS, so a collapsed run of spaces would fail here.
		expect(await code.locator('.line .text').allInnerTexts()).toEqual(lines);
		expect(await violations(page)).toEqual([]);
	});
});

test.describe('tap the cell', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(`/learn/${cellsDeck.id}`);
	});

	test('a tap picks a cell, Check answers, and the right cell takes the result', async ({ page }) => {
		const question = (await onScreen(page, cellQuestions)) as TapCellQuestion;
		await expect(page.getByRole('group', { name: new RegExp(`^(Array|String) ${question.sequence.name}, \\d+ cells$`) })).toBeVisible();
		await expect(page.getByRole('main').getByLabel('Code')).toBeVisible();
		await expect(primary(page)).toBeDisabled();
		await cell(page, question.correct).check();
		await expect(primary(page)).toBeEnabled();
		await primary(page).click();
		await expect(panel(page)).toHaveAccessibleName('Correct');
		await expect(primary(page)).toBeFocused();
		await expect(cell(page, question.correct)).toHaveAccessibleName(/, the right cell$/);
		await expect(page.getByRole('status')).toHaveText(`Correct. ${plainText(question.explanation, 1000)}`);
		expect(await violations(page)).toEqual([]);
	});

	test('a wrong tap: the tap in rose, the right cell marked, the miss explained, no follow-up', async ({ page }) => {
		const question = (await onScreen(page, cellQuestions)) as TapCellQuestion;
		const miss = question.misses[0];
		await cell(page, miss.index).check();
		await primary(page).click();
		await expect(panel(page)).toHaveAccessibleName('Not quite');
		await expect(panel(page)).toContainText(plainText(miss.explanation, 1000));
		await expect(cell(page, miss.index)).toHaveAccessibleName(/, your tap, not right$/);
		await expect(cell(page, question.correct)).toHaveAccessibleName(/, the right cell$/);
		await expect(page.getByRole('status')).toHaveText(
			`Not quite. The right answer: ${plainText(cellLabel(question, question.correct), 300)}. ${plainText(miss.explanation, 1000)}`
		);
		expect(await violations(page)).toEqual([]);
		await primary(page).click();
		await expect(page.getByRole('progressbar', { name: 'Lesson progress' })).toHaveAttribute('aria-valuenow', '1');
		await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
	});

	test('markers sit under their cells, and the slot past the end is dashed with its own index', async ({ page }) => {
		const seen = new Set<string>();
		for (let index = 0; index < cellQuestions.length; index++) {
			const question = (await onScreen(page, cellQuestions)) as TapCellQuestion;
			const strip = page.getByRole('group', { name: /cells$/ });
			for (const marker of question.markers ?? []) {
				await expect(cell(page, marker.at)).toHaveAccessibleName(new RegExp(`marked .*\\b${marker.name}\\b`));
				await expect(strip.getByText(marker.name, { exact: true })).toBeVisible();
				seen.add('markers');
			}
			if (question.sequence.pastEnd) {
				const slot = cell(page, question.sequence.cells.length);
				await expect(slot).toHaveAccessibleName(`Index ${question.sequence.cells.length}, past the end`);
				expect(await slot.evaluate((input) => getComputedStyle(input.parentElement!).borderStyle)).toBe('dashed');
				seen.add('past end');
			}
			await answerRight(page, question);
		}
		expect([...seen].sort()).toEqual(['markers', 'past end']);
	});

	test('a strip wider than a phone scrolls inside itself, not the page', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		const wide = decks.find((candidate) => candidate.id === 'dp-storage-review')!;
		const pool = wide.questions.filter(runs);
		await page.goto(`/learn/${wide.id}`);
		for (let step = 0; step < pool.length; step++) {
			const question = await onScreen(page, pool);
			if (question.id === 'storage-review-tap-oldest') break;
			await answerRight(page, question);
		}
		const strip = page.getByRole('group', { name: 'Array ways, 10 cells' });
		const scroller = strip.locator('..');
		expect(await scroller.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
		await cell(page, 9).check();
		const box = (await cell(page, 9).locator('..').boundingBox())!;
		expect(box.x + box.width).toBeLessThanOrEqual(390);
	});
});

test.describe('with Immediate feedback on', () => {
	test.beforeEach(async ({ page }) => {
		await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ immediateFeedback: true })), PREFERENCES_KEY);
	});

	test('cells are buttons: arrow keys move focus without answering, and Enter answers', async ({ page }) => {
		await page.goto(`/learn/${cellsDeck.id}`);
		const question = (await onScreen(page, cellQuestions)) as TapCellQuestion;
		await expect(page.getByRole('radio')).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Check' })).toHaveCount(0);
		await page.getByRole('button', { name: /^Index 0,/ }).focus();
		await page.keyboard.press('ArrowRight');
		await expect(page.getByRole('button', { name: /^Index 1,/ })).toBeFocused();
		await page.keyboard.press('End');
		await expect(labelledCells(page).last()).toBeFocused();
		await expect(panel(page)).toHaveCount(0);
		await page.getByRole('button', { name: new RegExp(`^Index ${question.correct},`) }).focus();
		await page.keyboard.press('Enter');
		await expect(panel(page)).toHaveAccessibleName('Correct');
		expect(await violations(page)).toEqual([]);
	});

	test('answer tiles are buttons too, so an arrow key never picks an answer', async ({ page }) => {
		await page.goto(URL);
		await firstChoice(page);
		await expect(page.getByRole('radio')).toHaveCount(0);
		const answers = page.getByRole('group', { name: /./ }).getByRole('button');
		await answers.first().focus();
		await page.keyboard.press('ArrowDown');
		await expect(answers.nth(1)).toBeFocused();
		await expect(panel(page)).toHaveCount(0);
		await page.keyboard.press('Enter');
		await expect(panel(page)).toHaveAccessibleName(/^(Correct|Not quite)$/);
		expect(await violations(page)).toEqual([]);
	});
});

test.describe('motion (lesson Round 7)', () => {
	for (const motion of ['no-preference', 'reduce'] as const) {
		const full = motion === 'no-preference';

		test(`the next question slides in as the last slides out, ${full ? '24px' : 'fading only with Reduce effects'}`, async ({ page }) => {
			await page.emulateMedia({ reducedMotion: motion });
			await page.goto(URL);
			const question = await firstChoice(page);
			await pick(page, optionLabel(question, question.correct));
			await primary(page).click();
			// Continue is pressed in the page and the cards read on the next frame, well inside the 150ms.
			const frames = await page.evaluate(async () => {
				[...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Continue')!.click();
				await new Promise(requestAnimationFrame);
				return [...document.querySelectorAll<HTMLElement>('.content')].map((card) => ({
					leaving: card.hasAttribute('data-leaving'),
					inert: card.inert,
					hidden: card.getAttribute('aria-hidden'),
					transforms: card.getAnimations().flatMap((animation) => (animation.effect as KeyframeEffect).getKeyframes().map((frame) => String(frame.transform)))
				}));
			});
			const leaving = frames.find((frame) => frame.leaving)!;
			const arriving = frames.find((frame) => !frame.leaving)!;
			expect(leaving).toMatchObject({ inert: true, hidden: 'true' });
			if (full) {
				expect(leaving.transforms).toContain('translateX(-24px)');
				expect(arriving.transforms).toContain('translateX(24px)');
			} else {
				expect(new Set([...leaving.transforms, ...arriving.transforms])).toEqual(new Set(['translateX(0px)']));
			}
			await expect(page.locator('[data-leaving]')).toHaveCount(0);
		});

		test(`a progress segment ${full ? 'grows left to right' : 'fades in with Reduce effects'}`, async ({ page }) => {
			await page.emulateMedia({ reducedMotion: motion });
			await page.goto(URL);
			const fill = page.getByRole('progressbar', { name: 'Lesson progress' }).locator('span > span').first();
			const style = await fill.evaluate((node) => ({ transform: getComputedStyle(node).transform, opacity: getComputedStyle(node).opacity }));
			expect(style).toEqual({ transform: full ? 'matrix(0, 0, 0, 1, 0, 0)' : 'matrix(1, 0, 0, 1, 0, 0)', opacity: '0' });
		});

		test(`the summary ${full ? 'draws its path, then the ring, then the misses' : 'fades in as a whole with Reduce effects'}`, async ({ page }) => {
			await page.emulateMedia({ reducedMotion: motion });
			await page.setViewportSize({ width: 390, height: 844 });
			await page.goto(URL);
			for (let index = 0; index < shown.length; index++) await answerWrong(page, await onScreen(page));
			const delays = await page.evaluate(() => {
				const delay = (node: Element) => getComputedStyle(node).animationDelay;
				const svg = document.querySelector('[role="img"] svg')!;
				return {
					edges: [...svg.querySelectorAll('path.edge')].map(delay),
					segments: [...svg.querySelectorAll('path.segment')].map(delay),
					misses: delay(document.querySelector('section[aria-label="Missed questions"]')!)
				};
			});
			const segments = shown.length;
			if (full) {
				expect(delays.edges).toEqual(['0s', '0.15s']);
				expect(delays.segments).toEqual(Array.from({ length: segments }, (_, k) => `${(450 + k * 45) / 1000}s`));
				expect(delays.misses).toBe(`${(450 + (segments - 1) * 45 + 150) / 1000}s`);
			} else {
				expect(new Set([...delays.edges, ...delays.segments, delays.misses])).toEqual(new Set(['0s']));
			}
		});

		test(`leaving drawer mode mid-morph leaves the tree shown${full ? '' : ', with Reduce effects'}`, async ({ page, isMobile }) => {
			test.skip(isMobile, 'resizes to desktop');
			await page.emulateMedia({ reducedMotion: motion });
			await page.setViewportSize({ width: 390, height: 844 });
			await page.goto(URL);
			for (let index = 0; index < shown.length; index++) await answerWrong(page, await onScreen(page));
			// Open, then resize at once, inside the morph's first 125 ms.
			await page.getByRole('button', { name: 'Missed questions' }).click();
			await page.setViewportSize({ width: 1440, height: 900 });
			await expect(page.locator('.tree-wrap.faded')).toHaveCount(0);
			await expect.poll(() => page.locator('.tree-wrap').evaluate((node) => getComputedStyle(node).opacity)).toBe('1');
		});

		test(`the drawer ${full ? 'drifts the tree while dragged' : 'crossfades the tree with Reduce effects'}`, async ({ page }) => {
			await page.emulateMedia({ reducedMotion: motion });
			await page.setViewportSize({ width: 390, height: 844 });
			await page.goto(URL);
			for (let index = 0; index < shown.length; index++) await answerWrong(page, await onScreen(page));
			const handle = page.getByRole('button', { name: 'Missed questions' });
			// The branch node travels furthest between the curve and the flat row.
			const nodeY = () => page.evaluate(() => document.querySelector('circle.hollow')!.getBoundingClientRect().y);
			if (full) {
				const before = await nodeY();
				const box = (await handle.boundingBox())!;
				await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
				await page.mouse.down();
				await page.mouse.move(box.x + box.width / 2, box.y - 40, { steps: 6 });
				// A short drag moves the tree a little toward flat, and the drawer stays shut on release.
				expect(Math.abs((await nodeY()) - before)).toBeGreaterThan(0.5);
				await page.mouse.up();
				await expect(handle).toHaveAttribute('aria-expanded', 'false');
				await expect.poll(nodeY).toBeCloseTo(before, 0);
			} else {
				await handle.click();
				await expect(page.locator('.tree-wrap.faded')).toHaveCount(1);
				await expect(page.locator('.tree-wrap.faded')).toHaveCount(0);
				await expect(handle).toHaveAttribute('aria-expanded', 'true');
			}
		});
	}
});
