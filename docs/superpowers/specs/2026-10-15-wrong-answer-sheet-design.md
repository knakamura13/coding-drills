# Wrong-answer sheet

Design for the wrong-answer moment. Sheet phases stay in the UI. Lesson grading does not change.

## Decisions

- **M1** (sheet phases). `lesson.ts` still decides the verdict and the follow-up. The sheet decides when Continue appears.
- **V2** (flag only). The expanded explanation has no helpful vote. The flag stays on the short sheet.
- **D2** (no spoiler copy). An explanation shown before the follow-up must not contain the follow-up's correct option.

## Sheet states

The short sheet is `FeedbackSheet`. The expanded explanation is the existing `SeeWhySheet` dialog ("Why the answers differ"), closed with Got it, Escape, or the backdrop.

**C0** (correct main answer, and a correct follow-up). Title "Well done!". The option's explanation is in the sheet. Flag. Continue is the only action and it is focused. Enter activates Continue.

**W0** (wrong main answer, explanation not opened yet). Title "Not quite.". The body is "The correct answer:" plus the correct option's name. The explanation text is not in this sheet. Flag. The only action is Why?, and it is focused. Enter activates Why?. Continue is absent. "See why again" is absent.

**W1** (explanations open). The dialog shows two cards, in this order: "You picked" with that option's name and its explanation, then "Correct answer" with the right option's name and its explanation. No flag, no vote, no Continue. Got it, Escape, or the backdrop closes it.

**W2** (wrong main answer, explanation already opened). Same short sheet as W0. The actions are "See why again" and Continue. Continue is focused. Enter activates Continue. "See why again" reopens W1.

A follow-up has no Why? gate.

- A right follow-up uses C0. The explanation is the follow-up's single explanation.
- A wrong follow-up shows "Not quite.", the correct follow-up option's text, that same explanation, the flag, and Continue. "See why again" is absent.

Opening or closing W1 writes nothing. The attempt is still recorded when Continue finishes the question: immediately on a correct main answer, and after the follow-up on a wrong main answer.

"Already opened" lives in `Lesson.svelte` as `whySeen`. It resets when `stepKey` (`cursor:stage`) changes, which is a new question or the follow-up. It is not stored, not synced, and not part of `lesson.ts`. A reload drops the unfinished question, as it does today.

## Keyboard and focus

- W0: the focused control is Why?. Enter activates Why?, sets `whySeen`, and opens W1.
- W1: focus stays in the dialog. Enter does not advance the lesson. Closing the dialog returns to W2.
- W2, C0, and follow-up feedback: the focused control is Continue. Enter activates Continue.
- Number keys still do nothing while a verdict is up.
- Immediate feedback still checks on select and lands on W0 for a wrong main answer.

The live announcement stays "Not quite. The correct answer is {name}." on a wrong main answer. The dialog exposes the two explanations on its own.

## What does not change

- Grades: first-try right is `good`, follow-up right is `hard`, both wrong is `again`.
- `advance` still enters the follow-up without completing the question, and the controller still writes the attempt only when `completed` grows.
- Quit during W0, W1, or W2 still drops the unfinished question. The quit dialog still refers to answers already completed.
- Deck, review, weak, and practice share `Lesson.svelte`, so they share these states.
- The original problem stays pinned above the follow-up.
- A follow-up has no follow-up of its own.
- Flagging does not change the grade. The flag control remains on C0, W0, W2, and follow-up feedback.

## Spoiler check

Explanations shown before the follow-up are the picked option's explanation and the correct option's explanation. The follow-up's own explanation is shown after the follow-up is answered, so it may restate the answer.

`repeatsFollowUpAnswer(explanation, optionText)` is true when the option's words appear contiguously in the explanation:

- Tokenize by lowercasing, turning markdown markers and punctuation into spaces, and splitting on whitespace.
- If the option has fewer than 6 tokens, the whole token list must not appear contiguously.
- If the option has 6 or more tokens, no contiguous 6-token slice may appear.

`questionSchema` rejects a deck when this is true for a wrong option's explanation or the correct option's explanation, compared with that wrong option's follow-up correct option. The issue path points at the explanation.

This check does not catch a paraphrase. `pattern-identification` question `window-max-sum-k`, option `two-pointers`, says the answer comes from everything between the boundaries. The follow-up's correct option is "The result depends on every element between the two boundaries." That pair does not share 6 tokens. Rewrite it anyway. Any other explanation that lets a learner pick the follow-up's correct option without the follow-up prompt gets the same treatment, even when the token check is silent.

On `main` at `901f7fe` the token check matches 37 explanations. The implementation plan lists them.

## Tests

- Unit tests for `repeatsFollowUpAnswer`: a 6-token slice matches, a shorter shared phrase does not, an option shorter than 6 tokens matches only as a whole, and the `window-max-sum-k` paraphrase does not match.
- The existing domain test still expects a wrong main verdict to carry an empty inline explanation and a `seeWhy` payload. That payload is what W1 renders.
- `e2e/lesson.spec.ts` covers W0, W1, and W2 in order: Why? is the only action, the dialog has both cards, Got it reveals "See why again" and Continue, Continue opens the follow-up for the option that was picked.
- A correct main answer still has no "See why again" and no Why?.
- A follow-up sheet still has no "See why again".
- `continuePastWrong` in `e2e/helpers.ts` clicks Why?, Got it, then Continue. `playDeck` and every spec that leaves a wrong main answer use it. Continues after a correct answer or after a follow-up stay on Continue.

## Out of scope

Quit dropping an unfinished question, what "learned" and weak spots mean, curriculum order, menu wayfinding, a helpful vote, and new lesson types.
