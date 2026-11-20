# Authoring decks

A deck is one YAML file in `content/decks/`. The file name must equal the deck `id`. `pnpm dev`, `pnpm build`, and `pnpm test` all validate every deck and fail with the file and path of the first problem.

## Question design

### Prompt and worked setup

- Use the established name of the problem or concept. Define a new term once in plain language, then keep using the established name. Use the exact variable names from the snippet and render names, expressions, and literal values as monospace code. Give inline code a visible background in the lesson UI.
- Use plain headings and labels. Avoid the middle dot character in all learner-facing copy.
- Before the first question, establish the goal, show the state the learner is working with, and illustrate the rule or representation they need. For example, show a labeled table and one worked cell before asking a learner to read a diagonal cell. A later question can rely on an established rule and the state still visible on screen.
- In a first encounter, ask for one new inference or operation at a time. State which line ran or which moment the learner is predicting. Use the prompt to name that decision and point to the relevant cell, line, or item. Use fresh review to check recall and checkpoints to combine skills.
- If a learner needs a prerequisite to make sense of the question, supply it or teach it first. To review a teaching card, finish this sentence: “Given what the learner knows, this question asks them to infer ___.”

### Actions and answer options

- Use a direct action when the action gives evidence of the skill: tap the cell, move the pointer, enter the value, or pick the first failing character. When the decision is which whole state will result, show the candidate states as two clearly bounded answer controls or use a short set of complete alternatives. Keep all states at the same scale and use the same notation in every option.
- Keep read-only diagrams distinct from controls. Use one visible affordance per available action. When an entire stack preview is one answer, the whole preview is one button. When choosing an opener inside a stack, each selectable cell is its own button. Indicate valid targets without exposing the right answer. Use color together with a border, label, underline, or position.
- Single-answer questions can show the options directly. For a question that accepts multiple selections, say “Select one or more answers” and let the learner submit after selecting. State an exact count when the task requires one. In move or order questions, provide tap and keyboard alternatives to dragging.
- Give every option the same level of detail and a consistent form. Make each wrong option represent a plausible error. Run snippets and work through every option, including ties, index boundaries, and alternate interpretations of the prompt.

### Feedback and continuity

- On a correct intermediate answer, carry the resulting state into the next question immediately. Let the changed state show what happened. Give any finished result or substantive explanation inline on the question, without a standalone success screen or a Continue step.
- On a miss, keep the relevant state in view and explain the specific mistake where it happened. If a prerequisite is missing, give a small worked example and a fresh retry of that inference, then return to the original step. Avoid a wrong-answer path that resets unrelated progress.
- Review and checkpoint cues depend on the purpose of the exercise. Preserve the relevant visual context, remove any scaffolding that would reveal the decision being assessed, and keep checkpoint results until the sitting ends. A fresh input should give the learner a chance to apply the rule independently.

### Review each representation

These are candidate treatments for adapting authored questions. Review the visual representation separately from the answer format. A tap can select an index, a stack item, or a node. A stack can ask the learner to select an item or choose an entire resulting state. Verify each treatment with an actual question before adding a renderer.

| Representation | What to show | What the learner can do |
| --- | --- | --- |
| Array or string | Values or characters with aligned indices. Show active pointers and any legal end position. | Tap the cell, move a pointer, or predict a named result. Use repeated values when checking whether the learner distinguishes value from index. |
| 2D table for dynamic programming | The full row and column layout, including blank cells. Label axes and keep the layout fixed between steps. | Read a highlighted cell, fill one cell from visible prerequisites, then select the cell or value that answers the problem. |
| Grid for traversal | Starting cell, bounds, barriers and the allowed movement rule. Visually distinguish blocked and visited cells. | Select a legal neighbor or the next cell to process. Keep state visible across moves. |
| List references and mutation | Actual code names and one object per list. Arrows mean “refers to.” Use Python assignment in the snippet. | Predict what the named lists contain or which reference moves, then show the actual shared or separate objects. |
| Stack | Square cells in one vertical column with one dashed top guide. Keep a bracket input separate from its stack. | Select a whole candidate stack, select an opener within a stack, or identify the first closing bracket that fails the stack check. |
| Queue or deque | A row with named ends. Use **Front** and **Back**, and keep their positions stable. | Select the item removed or the end where an item is added. For a deque, show which ends the operation permits. |
| Heap or priority queue | The item and its priority, plus the heap order or tree when the shape matters. State any tie rule. | Pick the next item or select the child for a swap. |
| Linked list | The current node and its actual links. Label named pointers and show where the list ends. | Follow a link, select the new destination, or redirect a link. Keep the unaffected links in view. |
| Tree | Parent and child relationships with left and right positions where they matter. Identify the current node. | Select the next node or predict which subtree the rule visits. |
| Graph | The relevant neighborhood, edge direction, and the meaning of any labels or weights. Identify the current node. | Select a legal destination, the next node to visit, or the edge that changes state. |
| Call frames and backtracking | The active call, the saved state and the point of return. Keep call depth visible. | Select the returning frame, the value passed back, or the next choice to undo. |
| Map or set | Named keys and values, or set members. Keep repeated input separate from distinct keys. | Choose the lookup key, predict a value, or identify one membership change. |
| Intervals and event sweeps | A common number line with inclusive or exclusive endpoints and any tie rule. | Select the next event, tell whether intervals overlap, or choose the resulting interval. |
| Bits and masks | Bit positions and width, with any signedness rule that affects the answer. | Select a bit or predict one masked value. |
| Code, math or problem statement | The relevant snippet or problem contract, with enough context to determine an answer. | Pick a line, predict a short result, choose a counterexample, or compare complete statements. Use text choices when the explanation itself is the skill. |

For each type, review one first encounter, one likely miss, and one fresh example. Include the boundary conditions that change the rule, such as an empty stack, a grid edge, a tied priority or a duplicated value. Check what looks tappable, whether feedback points to the chosen item, and what happens after returning or using a keyboard. Then apply the agreed treatment to each mapped question as appropriate for teaching, review or a checkpoint.

### Review starting points

Start with [2D table cells](decks/grid-tables.yaml), [list references](decks/names-and-objects.yaml), [bracket stacks](decks/stack-matching.yaml), and [queues](decks/traversal-layers.yaml). These cover four different decisions worth seeing side by side: fill a cell, predict named values, choose a whole stack or one opener, and remove the front item. Review the deque variant alongside queues so both ends can be exercised.

Then sample [index and pointer moves](decks/exact-search.yaml), [grid traversal](decks/reachability.yaml), [heaps](decks/heap-operations.yaml), [linked lists](decks/link-rewrites.yaml), [trees](decks/tree-walks.yaml), [graphs](decks/dependency-order.yaml), [call frames](decks/recursive-calls.yaml), [maps](decks/hash-lookups.yaml), [intervals](decks/interval-merging.yaml), [bit positions](decks/bit-manipulation.yaml), and [problem statements](decks/problem-solving-routine.yaml).

The inventory at the start of this review contained 996 authored questions in 145 decks. It included 673 choices, 151 cell taps, 64 pointer placements, and 108 step traces. Review at both levels: exercise each answer format, then check each visual representation where the learner uses it. For each prototype, record the decision being tested, the action and feedback, and the relevant question IDs. Get the design reviewed before applying it across the corpus.

## Shape

```yaml
id: pattern-identification # must match the file name
title: Pattern identification
description: One sentence shown on the deck card.
heading: Which pattern best fits? # default line above each problem card (optional)

questions:
  - id: window-max-sum-k
    heading: Which pattern best fits? # overrides the deck heading (optional)
    tags: [sliding-window] # optional
    prompt: Find the maximum sum of any contiguous subarray of exactly size `k`.
    options:
      - id: two-pointers
        text: Two Pointers
        explanation: Why this option is right or wrong for THIS problem.
      - id: sliding-window
        text: Sliding Window
        explanation: ...
      # ...two to six options; four reads best
    correct: sliding-window
    followUps: # exactly one per wrong option, none for the correct one
      two-pointers:
        prompt: The distinction between this pick and the answer, as a question.
        options: # two to four; three reads best
          - { id: a, text: One plausible misconception }
          - { id: b, text: The true distinction }
          - { id: c, text: Another plausible misconception }
        correct: b
        explanation: The rule, in one to three sentences.
```

Prompts and explanations are Markdown: paragraphs, `` `inline code` ``, **bold**, *italics*, and fenced code blocks. Option text is inline Markdown. Quote any YAML value that starts with a backtick or contains `: `.

## Tap the cell

A question with `format: tap-cell` asks the learner to tap one cell of an array or a string. Leave `format` off, or set it to `choice`, for a multiple-choice question. Existing decks do not need a `format` field.

```yaml
- id: read-at-index
  format: tap-cell
  tags: [python]
  prompt: Which cell does `nums[1]` read?
  code: |
    nums = [3, 0, 1, 2]
    print(nums[1])
  sequence:
    kind: array # or string
    name: nums # optional label drawn above the cells
    cells: [3, 0, 1, 2] # numbers are stored as text; a string cell is one character
    pastEnd: false # true adds a tappable slot at index len(cells)
  markers: # optional pointers. They label the picture; they are not the answer.
    - { name: i, at: 0 } # names such as left, right, i
  correct: 1 # index of the cell that answers the question
  explanation: Why that cell is right.
  misses: # every other tappable index, including a past-the-end slot, and not the correct one
    - { index: 0, explanation: Why this cell is the wrong one. }
```

In portrait the snippet sits above the sequence. In landscape they sit side by side. A wrong tap highlights that cell, shows its `explanation`, and then marks the right cell. There is no follow-up question: the miss is the targeted feedback. `code` is plain text, not Markdown.

## Drag the pointers

A question with `format: drag-pointers` asks the learner to move named pointers (`left`, `read`, `i`) to the cells they reach after the step the prompt describes. They drag a pointer, or tap it and then a cell, or focus it and use the arrow keys. They press Check, and the answer is right only when every pointer is on its cell.

```yaml
- id: sum-step-too-small
  format: drag-pointers
  tags: [python, two-pointers]
  prompt: Where do `l` and `r` sit when this pass ends?
  code: |
    total = nums[l] + nums[r]
    if total < target:
        l += 1
  sequence: { kind: array, name: nums, cells: [1, 4, 6, 8, 11, 15, 20] } # at most 8 cells
  markers: # optional pointers that stay put
    - { name: i, at: 0 }
  pointers: # one to three movable pointers; at least one must start away from its cell
    - name: l
      start: 1
      correct: 2
      explanation: Why l belongs here.
      misses: # targeted feedback for the likely wrong cells
        - { index: 3, explanation: What this placement gets wrong. }
      elsewhere: Fallback for any wrong cell not listed in misses.
    - { name: r, start: 5, correct: 5, explanation: Why r stays., elsewhere: Why r does not move. }
```

Each wrong pointer explains itself where it was left, and its right cell is then shown. There is no follow-up question. Write `misses` for the mistakes a learner would really make, and keep `elsewhere` for the rest. A pointer that stays put needs no miss for the other cells, only `elsewhere`.

## Step-through trace

A question with `format: step-trace` shows a numbered snippet with the running line highlighted, and an array with named pointers. The learner steps through and predicts each step before it is revealed: a pointer's cell (tap it) or a value (pick it). A wrong prediction explains itself in place, the true state is shown, and the trace carries on from the truth. The question is right only when every step was.

```yaml
- id: trace-sum-to-target
  format: step-trace
  tags: [python, two-pointers]
  prompt: Predict each step before it is shown.
  code: | # lines are numbered from 1
    total = nums[l] + nums[r]
    if total < target:
        l += 1
  sequence: { kind: array, name: nums, cells: [3, 5, 8, 10] } # at most 8 cells
  start: # every pointer, before step 1
    - { name: l, at: 0 }
    - { name: r, at: 3 }
  steps: # two to five
    - line: 1 # the line that runs in this step
      ask: Where does `l` sit after this pass?
      pointer: l # a cell step: the learner taps the cell
      correct: 1
      explanation: Why that cell.
      misses: # targeted feedback for the likely wrong cells
        - { index: 3, explanation: What this cell gets wrong. }
      elsewhere: Fallback for any other wrong cell.
      also: # other pointers that move in the same step, shown once it is revealed
        - { name: r, at: 3 }
    - line: 2
      ask: What is `total` on the next pass?
      options: # a choice step: two to four values, an explanation on every one
        - { id: eight, text: "8", explanation: Why 8 is the sum. }
        - { id: nine, text: "9", explanation: What 9 gets wrong. }
      correct: eight
```

Highlight the line that starts a step, not the line that moves a pointer, or the highlight gives the answer away. A pointer that is asked about moves to its `correct` cell after the step, whatever the learner picked.

## Mapping a deck onto the tree

Every question in `content/decks` is mapped to a skill path in `content/curriculum/<branch>.yaml`, under `drills:`. The build fails for a question that is not mapped.

```yaml
- questionId: trace-sum-to-target
  disposition: keep # keep or rewrite: a teaching drill. exam: reserved for a checkpoint. retire: counted nowhere.
  path: pointer-scans
  skill: choose-moving-end # keep and rewrite only: the skill it teaches. Without it, drills pair with skills by list position.
  # variant: true # keep only, with an explicit skill. Use this on fresh review examples.
  note: What the drill asks.
- questionId: checkpoint-unique-pairs
  disposition: exam
  path: pointer-scans
  tests: [handle-repeats, preserve-distinct-indices] # skills a missed item sends the learner back to review
  covers: [unique-pairs] # kinds of item this one counts toward; see `mix` below
  checkpoint: unique-pairs-or-compaction # only on a path with two checkpoints; otherwise exam drills pair with them by list position
  note: What the item checks.
```

A checkpoint can list `mix: [kind, ...]` (only on a path with one checkpoint). Every exam then includes at least one item whose `covers` names each kind, and a checkpoint is passed only when each kind was answered right. A skill needs at least three drills, since it is mastered only while its latest answer on every drill was right.

When a checkpoint's exam pool grows, each old item sets `legacyPassBefore` to the exam rules version that introduces the change. The items that share that version are the old pool, and an older sitting of it still passes under the rule it was taken under: every old item (up to five) answered on one day, with at most one miss when the pool had more than one item. For a one-item pool that is one correct answer. New attempts use the full sitting rule.

## Tags

Give every question one to three `tags`. They come from the fixed list in `src/lib/content/tags.ts` (`hash-map`, `sliding-window`, `dp`, and so on), and the build rejects any other value. Tags are the topics shown on the Progress screen and offered as filters in Mixed practice, so a fixed list stops near-duplicates such as `queue` and `queues`. To add a topic, add it to that list. A question with no tags is skipped by both screens.

## Rules the build enforces

- Every wrong option has a follow-up, and the correct option has none.
- A tap-cell question explains every wrong cell, and the correct index has no miss. Marker names are unique and land on a cell.
- A step-trace question has two to five steps. A cell step names a pointer from `start`, has no miss on its right cell, and an `elsewhere` fallback. A choice step has a `correct` id that is one of its options. `line` is inside the snippet.
- A drag-pointers question has pointers and markers with unique names on real cells, at least one pointer that has to move, no miss on a pointer's right cell, and an `elsewhere` explanation for every pointer.
- `correct` ids exist in their option lists. Option ids and option texts are unique within a question or follow-up.
- Ids are lowercase kebab-case. Unknown keys are rejected, so typos do not pass silently.

## What makes a good follow-up

The follow-up appears right after the learner picked a specific wrong option. It checks whether they now understand why that pick was wrong.

- Aim at the single distinction that separates their pick from the answer, not at the whole topic. "What makes this a sliding window rather than a two-pointer search?" works because it names both techniques.
- One option states the real distinction. The other options are misconceptions a learner could believe, not jokes. A distractor that is true but irrelevant is fine. A distractor that is simply absurd teaches nothing.
- The explanation states the rule in one to three sentences, so a right guess still learns the reason.
- Do not reuse one follow-up for several wrong options. Each pick has its own misconception.
- Be honest about alternatives. When a "wrong" option would also work but is worse (a prefix-sum array also solves a fixed-width window), say why it is not the best fit instead of calling it incorrect.

## Wording

Write every prompt and explanation yourself. Do not copy problem statements or explanations from books, courses, or other apps. This repository is public.

## Before committing a deck

1. `pnpm test` (validates the schema and plays random sessions over every deck).
2. Play the deck in the app and pick every wrong option once.
3. Read each explanation as a skeptic. A wrong explanation teaches the wrong thing, so check claims about complexity and edge cases. Run every code snippet in Python and paste the real output, never an expected one.
4. Check that no wrong option is also defensibly correct for the way the question is worded (for example "average case" versus "worst case", or whether the returned value counts as extra space). If it is, reword the question or the option.

## Reporting a bad question

The flag icon on any feedback sheet saves a note on the device. The summary screen turns flags into prefilled GitHub issues labelled `content`.
