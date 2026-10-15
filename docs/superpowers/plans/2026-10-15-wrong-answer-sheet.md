# Wrong-answer sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A wrong main answer opens on Why?, the existing explanation dialog is the only way to reveal Continue, and explanations shown before the follow-up do not contain the follow-up's correct option.

**Architecture:** `lesson.ts` still builds the verdict and `seeWhy`. `Lesson.svelte` remembers whether Why? was opened for this `stepKey` and chooses the sheet's primary button. `questionSchema` rejects a pre-follow-up explanation that repeats the follow-up's correct option.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript 6, Vitest, Playwright. Use `pnpm`.

## Global Constraints

- Sheet phases stay in the UI. Do not add a lesson stage for the explanation.
- No helpful vote. The flag stays on the short sheet.
- A wrong option's explanation and the correct option's explanation must not contain the follow-up's correct option, by the token rule in the spec.
- The follow-up's own explanation may restate the answer.
- Grades, `advance`, and when the attempt is written stay as they are.
- Got it, Escape, and the backdrop close the explanation dialog.
- Deck, review, weak, and practice share this sheet.

---

### Task 1: Token check

**Files:**
- Modify: `src/lib/content/schema.ts`
- Test: `src/lib/content/schema.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `repeatsFollowUpAnswer(explanation: string, optionText: string): boolean`

- [ ] **Step 1: Write the failing test**

Add this to `src/lib/content/schema.test.ts`:

```ts
import { repeatsFollowUpAnswer } from './schema.ts';

describe('repeatsFollowUpAnswer', () => {
	it('matches a contiguous 6-word slice', () => {
		expect(
			repeatsFollowUpAnswer(
				'You would still need to repeatedly remove and re-insert overlapping intervals as you expand.',
				'Repeated removals and re-insertions as the merged range grows'
			)
		).toBe(false);
		expect(
			repeatsFollowUpAnswer(
				'The heap holds all n scores, so the bound is the whole input.',
				'The heap holds all n scores and nothing is dropped'
			)
		).toBe(true);
	});

	it('ignores a shared phrase shorter than 6 words when the option is longer', () => {
		expect(
			repeatsFollowUpAnswer(
				'Sorting the array is O(n log n) before the scan.',
				'The sort costs O(n log n) and then a linear scan finishes the job'
			)
		).toBe(false);
	});

	it('matches a whole option that is shorter than 6 words', () => {
		expect(repeatsFollowUpAnswer('Use a hash map as a key here.', 'a hash map')).toBe(true);
		expect(repeatsFollowUpAnswer('Use a tree.', 'a hash map')).toBe(false);
	});
});
```

The first expectation is the `window-max-sum-k` class of paraphrase: different words, so the function returns false. The second expectation is a real 6-word overlap and returns true.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/lib/content/schema.test.ts`

Expected: FAIL because `repeatsFollowUpAnswer` is not exported.

- [ ] **Step 3: Implement the function**

Add this above `questionSchema` in `src/lib/content/schema.ts`:

```ts
/** Tokens used to compare an explanation with a follow-up option. */
export function contentTokens(value: string): string[] {
	return value
		.toLowerCase()
		.replace(/[`*_#>[\]()]/g, ' ')
		.replace(/[^\p{L}\p{N}\s]/gu, ' ')
		.split(/\s+/)
		.filter((token) => token.length > 0);
}

function containsTokens(haystack: readonly string[], needle: readonly string[]): boolean {
	if (needle.length === 0 || haystack.length < needle.length) return false;
	for (let start = 0; start <= haystack.length - needle.length; start++) {
		let same = true;
		for (let offset = 0; offset < needle.length; offset++) {
			if (haystack[start + offset] !== needle[offset]) {
				same = false;
				break;
			}
		}
		if (same) return true;
	}
	return false;
}

/**
 * True when `optionText` appears inside `explanation`.
 * Options shorter than 6 tokens must appear whole.
 * Longer options fail on any contiguous 6-token slice.
 */
export function repeatsFollowUpAnswer(explanation: string, optionText: string): boolean {
	const haystack = contentTokens(explanation);
	const needle = contentTokens(optionText);
	if (needle.length === 0) return false;
	if (needle.length < 6) return containsTokens(haystack, needle);
	for (let start = 0; start <= needle.length - 6; start++) {
		if (containsTokens(haystack, needle.slice(start, start + 6))) return true;
	}
	return false;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/lib/content/schema.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/schema.ts src/lib/content/schema.test.ts
git commit -m "feat: detect explanations that repeat a follow-up answer"
```

### Task 2: Reject spoiler explanations in the schema

**Files:**
- Modify: `src/lib/content/schema.ts` (`questionSchema` superRefine, and the comment on `optionSchema.explanation`)
- Test: `src/lib/content/schema.test.ts`

**Interfaces:**
- Consumes: `repeatsFollowUpAnswer`
- Produces: `deckSchema` issues at `questions.N.options.M.explanation` when a pre-follow-up explanation repeats that wrong option's follow-up answer

- [ ] **Step 1: Write the failing test**

Add to `src/lib/content/schema.test.ts`:

```ts
it('rejects an explanation that repeats the follow-up answer', () => {
	const deck = validDeck();
	deck.questions[0].options[1].explanation =
		'Wrong A fails because Reason X is the one you needed here today';
	deck.questions[0].followUps['wrong-a'].options[0].text =
		'Reason X is the one you needed here today';
	const result = deckSchema.safeParse(deck);
	expect(result.success).toBe(false);
	if (!result.success) {
		expect(formatIssues('sample.yaml', result.error.issues)).toContain(
			'questions.0.options.1.explanation'
		);
	}
});
```

The existing valid deck uses the two-token option "Reason X", and "Because it is wrong." does not contain those tokens, so it still parses. This test uses a longer follow-up option that sits contiguously inside the explanation.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/lib/content/schema.test.ts`

Expected: FAIL because the deck still parses.

- [ ] **Step 3: Enforce the check**

Change the comment on `optionSchema.explanation` to:

```ts
/** Shown from Why? before a follow-up, or inline when this option is the correct answer. */
```

Inside `questionSchema`'s `superRefine`, after the follow-up key checks and before `for (const issue of issues)`, add:

```ts
const correctOption = question.options.find((option) => option.id === question.correct);
for (const [optionId, followUp] of Object.entries(question.followUps)) {
	if (!correctOption || optionId === question.correct || !ids.includes(optionId)) continue;
	const picked = question.options.find((option) => option.id === optionId);
	const followUpCorrect = followUp.options.find((option) => option.id === followUp.correct);
	if (!picked || !followUpCorrect) continue;
	if (repeatsFollowUpAnswer(picked.explanation, followUpCorrect.text)) {
		issues.push({
			message: `explanation repeats the follow-up answer "${followUpCorrect.text}"`,
			path: ['options', ids.indexOf(optionId), 'explanation']
		});
	}
	if (repeatsFollowUpAnswer(correctOption.explanation, followUpCorrect.text)) {
		issues.push({
			message: `explanation repeats the follow-up answer for "${optionId}"`,
			path: ['options', ids.indexOf(question.correct), 'explanation']
		});
	}
}
```

- [ ] **Step 4: Run the test to verify the new test passes and the deck suite fails**

Run: `pnpm exec vitest run src/lib/content/schema.test.ts src/lib/content/loadDecks.test.ts`

Expected: `schema.test.ts` passes. `loadDecks.test.ts` fails because real decks still contain the 37 overlaps listed in Task 3.

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/schema.ts src/lib/content/schema.test.ts
git commit -m "feat: reject explanations that repeat a follow-up answer"
```

Do this only if `schema.test.ts` is green. Leave the deck failures for Task 3. If the commit hook runs the full test suite and rejects the commit, keep the schema change staged and complete Task 3 before this commit, then use the commit message above for both.

### Task 3: Rewrite the overlapping explanations

**Files:**
- Modify: the deck files named below
- Test: `src/lib/content/loadDecks.test.ts` (already loads every deck)

**Interfaces:**
- Consumes: `repeatsFollowUpAnswer` via `deckSchema`
- Produces: `pnpm exec vitest run src/lib/content/loadDecks.test.ts` passes

Each row is `file`, `question id`, `wrong option id`, `picked` or `correct` (which explanation), and the 6 tokens that must disappear. Rewrite that explanation so those tokens are not a contiguous slice, and so a learner still cannot pick the follow-up's correct option from the new wording. Keep the explanation true. Do not change the follow-up option text to dodge the check. Run any code snippet you add or change in Python before leaving it in an explanation.

Also rewrite `content/decks/pattern-identification.yaml` question `window-max-sum-k`, option `two-pointers`. The token check does not see it. Replace:

```yaml
explanation: >-
  Two pointers compare the values at two positions, such as a pair that sums to a target.
  Here the answer comes from everything between the boundaries, so the boundaries are the
  edges of a window, not two values to compare.
```

with:

```yaml
explanation: >-
  Two pointers compare the values at two positions, such as a pair that sums to a target.
  A fixed-width window moves as one block. The values at its edges are not being compared
  with each other.
```

Overlaps on `main` at `901f7fe`:

- `binary-search-on-answer.yaml` `first-position-duplicates` `le-moves-right` picked: "the first index with a i"
- `binary-search-on-answer.yaml` `binary-search-preconditions` `linked-list-ok` picked: "walks add up to about n"
- `complexity-analysis.yaml` `frequency-count` `constant` picked: "for each of the n items"
- `cost-python-data-model.yaml` `slice-in-recursion` `exponential` picked: "one so the calls form a"
- `graph-algorithms.yaml` `kahn-short-result` `disconnected` picked: "every node whose in degree is"
- `graph-algorithms.yaml` `kahn-short-result` `only-cycle-nodes` picked: "its prerequisite 3 is never processed"
- `graph-algorithms.yaml` `kahn-short-result` `append-rest` picked: "goes first has a prerequisite among"
- `graph-algorithms.yaml` `union-find-link-stream` `bfs-each-query` picked: "and only one or a few"
- `graph-algorithms.yaml` `dijkstra-stale-entry` `wrong-distances` picked: "dist u w which already bounded"
- `graph-algorithms.yaml` `count-components-edge-list` `nodes-minus-edges` picked: "only when the graph has no"
- `graph-traversal-grids.yaml` `recursive-dfs-depth` `switch-bfs` correct: "each pending cell is a nested"
- `graph-traversal-grids.yaml` `grid-bounds-and-cost` `quadratic` picked: "each cell is marked on first"
- `hash-maps-prefix-sums.yaml` `two-sum-unsorted` `sort-two-pointers` picked: "the sort costs o n log"
- `hash-maps-prefix-sums.yaml` `longest-consecutive-set` `set-count-from-all` picked: "value 0 walks n 1 steps"
- `hash-maps-prefix-sums.yaml` `contains-duplicate-tradeoff` `sort-and-compare` picked: "o n log n time instead"
- `heaps-top-k.yaml` `shortest-job-first` `sorted-list` picked: "is o n in the worst"
- `heaps-top-k.yaml` `top-k-min-heap` `heap-all` picked: "the heap holds all n scores"
- `heaps-top-k.yaml` `heapify-vs-pushes` `both-n-log-n` picked: "near the bottom where a sift"
- `linked-lists.yaml` `dummy-head` `only-way` picked: "while head and head value target"
- `linked-lists.yaml` `cost-model` `two-pass-quadratic` picked: "1 5n which is o n"
- `monotonic-stack.yaml` `next-taller-stall` `nested-scan` picked: "every scan runs to the end"
- `monotonic-stack.yaml` `stack-loop-cost` `avg-linear` picked: "pops exactly one entry the previous"
- `monotonic-stack.yaml` `bracket-balance` `three-counters` picked: "which opener is the most recent"
- `monotonic-stack.yaml` `bracket-balance` `stack-unguarded` picked: "raises indexerror pop from empty list"
- `one-dimensional-dp.yaml` `overlapping-subproblems` `two-branches-always` picked: "each call gets its own half"
- `one-dimensional-dp.yaml` `tiling-recurrence` `uses-product` picked: "a 1 or a 3 never"
- `one-dimensional-dp.yaml` `space-two-variables` `one-variable` picked: "adds every slot to a total"
- `one-dimensional-dp.yaml` `memoization-complexity` `no-depth-limit` picked: "nothing is cached before the first"
- `pattern-identification.yaml` `cost-nested-slice-sum` `exponential` picked: "a subarray is fixed by its"
- `sorting-interval-sweeps.yaml` `insert-interval-three-phases` `append-and-merge` picked: "5 12 is folded into 14"
- `trees-traversals-bst.yaml` `postorder-output` `level-order` picked: "finishes the whole subtree under 2"
- `trees-traversals-bst.yaml` `bst-bounds-check` `root-value` picked: "in the right subtree of the"
- `trees-traversals-bst.yaml` `level-order-queue` `drain-queue` picked: "before the queue is checked again"
- `two-pointers-sliding-window.yaml` `shrink-while-not-if` `count-valid-only` picked: "so docs deploy and deploy are"
- `two-pointers-sliding-window.yaml` `window-loop-cost` `quadratic` correct: "day leaves the window at most"
- `two-pointers-sliding-window.yaml` `window-loop-cost` `constant-space` picked: "in the window up to k"
- `two-pointers-sliding-window.yaml` `window-needs-monotonic-sums` `whole-list-total` correct: "trimming from the left is safe"

- [ ] **Step 1: Rewrite each row and the two-pointers paraphrase**

Edit the explanation named by the row. Read the follow-up prompt and its correct option first. The new explanation teaches why the picked option is wrong, or why the correct option is right, without stating that follow-up option.

- [ ] **Step 2: Run the deck tests**

Run: `pnpm exec vitest run src/lib/content/loadDecks.test.ts src/lib/content/schema.test.ts`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add content/decks src/lib/content/schema.ts src/lib/content/schema.test.ts
git commit -m "fix: stop explanations from repeating follow-up answers"
```

### Task 4: Why? before Continue

**Files:**
- Modify: `src/lib/components/FeedbackSheet.svelte`
- Modify: `src/lib/components/Lesson.svelte`
- Modify: `src/lib/domain/lesson.ts` (comment on `Verdict.explanation` only)
- Modify: `e2e/helpers.ts`
- Modify: `e2e/lesson.spec.ts`
- Modify: `e2e/site.spec.ts`
- Modify: `e2e/review.spec.ts`
- Modify: `e2e/settings.spec.ts`
- Modify: `e2e/pwa.spec.ts`
- Modify: `e2e/sync.spec.ts`

**Interfaces:**
- Consumes: `screen.seeWhy`, `screen.verdict`, `lesson.stepKey`, `lesson.advance`
- Produces: `continuePastWrong(page)` in `e2e/helpers.ts`. Wrong main sheets render Why? until the dialog has been opened.

- [ ] **Step 1: Write the failing end-to-end test**

In `e2e/lesson.spec.ts`, replace the test `a wrong answer opens See why again, then its own follow-up` with:

```ts
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
```

- [ ] **Step 2: Run that test to verify it fails**

Run: `pnpm exec playwright test e2e/lesson.spec.ts -g "opens Why?"`

Expected: FAIL because the sheet shows "See why again" and Continue, not Why?.

- [ ] **Step 3: Add the helper and point the other wrong-main exits at it**

In `e2e/helpers.ts`:

```ts
/** Leaves a wrong main answer: Why?, Got it, Continue. Does not answer the follow-up. */
export async function continuePastWrong(page: Page) {
	await page.getByRole('button', { name: 'Why?', exact: true }).click();
	await page.getByRole('dialog', { name: 'Why the answers differ' }).getByRole('button', { name: 'Got it' }).click();
	await continueButton(page).click();
}
```

In `playDeck`, replace the wrong-branch `continueButton(page).click()` that happens before the follow-up wait with `continuePastWrong(page)`. Leave the Continue after the follow-up answer as `continueButton`.

Use `continuePastWrong` anywhere a spec clicks Continue to leave a wrong main answer:

- `e2e/lesson.spec.ts`: the loop that visits each wrong option, the right-follow-up test, the wrong-follow-up test, and the follow-up flag test. The new Why? test drives Why?, Got it, and Continue itself.
- `e2e/site.spec.ts`: the follow-up axe test, and the phone overflow walk. The wrong-sheet axe test clicks Why? instead of "See why again":

```ts
await page.getByRole('button', { name: 'Why?', exact: true }).click();
await expect(page.getByRole('dialog', { name: 'Why the answers differ' })).toBeVisible();
```

- `e2e/review.spec.ts` after the first wrong main answer
- `e2e/settings.spec.ts` in the immediate-feedback test, after "Not quite."
- `e2e/pwa.spec.ts` after the wrong main answer that expects zero saved attempts
- `e2e/sync.spec.ts` after saving a flag on a wrong main answer

Correct-answer Continues stay on `continueButton`.

- [ ] **Step 4: Implement the sheet**

`FeedbackSheet.svelte` props become:

```ts
interface Props {
	tone: 'correct' | 'wrong';
	title: string;
	height?: number;
	onflag: () => void;
	/** Outline button above the primary action. Present on W2 only. */
	onseewhy?: () => void;
	primary: 'Continue' | 'Why?';
	onprimary: () => void;
	children: Snippet;
}
```

Focus `primaryButton` in the existing effect. Render `onseewhy` as the outline "See why again" button when it is set. Render one primary button labeled `primary`. Its variant is `success` when `tone === 'correct'`, otherwise `danger`.

In `Lesson.svelte`:

```ts
let whySeen = $state(false);

$effect(() => {
	void lesson.stepKey;
	whySeen = false;
	seeWhyOpen = false;
});
```

Keep the existing effect that focuses the heading. Do not merge them if that drops `tick()`.

```ts
const whyGate = $derived(Boolean(screen?.seeWhy) && verdict !== null && !verdict.correct);

function openWhy() {
	whySeen = true;
	seeWhyOpen = true;
}

function onPrimary() {
	if (whyGate && !whySeen) openWhy();
	else proceed();
}
```

Pass `primary={whyGate && !whySeen ? 'Why?' : 'Continue'}` and `onprimary={onPrimary}`. Pass `onseewhy` only when `whyGate && whySeen`.

Enter in `onkeydown`, when a verdict is up and the event target is not a button or link:

```ts
if (whyGate && !whySeen) openWhy();
else proceed();
```

Update the comment on `Verdict.explanation` in `src/lib/domain/lesson.ts` to: "Shown inline on a correct answer and on follow-up feedback. Empty on a wrong main answer, where Why? opens seeWhy."

- [ ] **Step 5: Run the lesson tests**

Run: `pnpm exec playwright test e2e/lesson.spec.ts e2e/site.spec.ts e2e/settings.spec.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/FeedbackSheet.svelte src/lib/components/Lesson.svelte src/lib/domain/lesson.ts e2e
git commit -m "feat: open wrong answers on Why? before Continue"
```

### Task 5: Full check

**Files:** none

**Interfaces:**
- Consumes: Tasks 1–4
- Produces: a green `pnpm test` and `pnpm check`

- [ ] **Step 1: Run the unit tests and the type check**

Run: `pnpm test && pnpm check`

Expected: PASS. `pnpm test` includes the deck schema, so a leftover spoiler fails here.

- [ ] **Step 2: Run end-to-end**

Run: `pnpm exec playwright test`

Expected: PASS. Install a missing browser with `pnpm exec playwright install` if the run says the browser is absent. `PW_CHANNEL=chrome` only affects the Chromium projects.

- [ ] **Step 3: Commit only if Step 1 or Step 2 required a fix**

```bash
git add -u
git commit -m "fix: finish the wrong-answer sheet checks"
```
