# Profile: coding interviews

The first filled [subject profile](subject-profile.md), written from the curriculum as built. Where a decision came from an owner answer it is stated as fixed. Sources for most decisions are issues #9, #95, #154 and #155 and the briefs kept outside the repo.

## 0. Viability

Likely viable. Gates G1 to G6 pass: five branches off a Foundations hub with a few named cross-branch prerequisites and no cycle, a Python runtime as the oracle, each wrong option tied to a misconception, arrays and graphs drawn as text and cells. See the worked example in [`viability.md`](viability.md).

## 1. Audience and baseline

- **Learner.** Someone preparing for coding interviews at general tech and non-tech companies. Top-tier and AI-lab-only material is tagged deep.
- **Baseline.** Reads basic Python: loops, functions, lists, dicts and sets, comprehensions and common built-ins. Anything past that is taught before a card uses it. Slicing, `//`, aliasing, Big-O and binary are all taught, not assumed. A card relying on an operator past the baseline states it in one clause.
- **Target level.** The default depth is `interview`.

## 2. Scope source

- **Source of truth.** A widely used interview-prep book's algorithm chapters plus current, dated evidence on what interviews ask (problem lists, hiring reports, candidate reports, and reporting on how AI tools changed interviews). Researched twice on different models and reconciled.
- **Weighting.** High, medium or low, each with cited evidence and a trend.
- **Freshness.** Re-check when interview formats shift materially. The last full pass was November 2026.

## 3. Verification oracle

| Kind of claim | How it is checked | Who can check |
| --- | --- | --- |
| Code output, trace, index, count | Run in CPython 3.12 with `python3 -I`, one check file per deck | Any agent |
| Complexity claim | Reasoned, then cross-checked against brute force on small random inputs | Any agent, reviewer independently |
| Edge cases | Probe empty input, `n = 1`, ties, negatives, duplicates, big integers | Any agent |

Complexity statements that depend on interpreter internals are the weakest class. A reviewer rechecks them.

## 4. Question formats

Built: multiple choice, tap the cell, drag the pointers, step-through trace. Details in `content/README.md`. The representation table there maps each data structure to what to show and what the learner can do.

Missing: entering a value, choosing among whole candidate states, and questions with several right answers. Each needs the new-format process in `content/README.md`.

## 5. Vocabulary

- **Tags.** The fixed list in `src/lib/content/tags.ts`. A topic is added there by editing the list.
- **Term owners.** Set per term in the reconciled plan: "live call", "suffix", "stopping case", "subarray", "pass", "extra space", "indices".
- **Naming rules.** "Indices", never "indexes". A suggested solution is called "a suggested solution", never "an AI". No middle-dot character in learner copy. Use established problem names, and define a new term once.

## 6. Depth axis

`interview` (default), then `deep` (algorithms-course material). `DEPTHS` in `src/lib/content/curriculum.ts` orders them, so a level can be added. Items inherit their parent's depth and may only be deeper.

## 7. Structure

- **Branches.** Foundations, Sequences and search, Data structures, Trees and graphs, Problem-solving patterns.
- **Prerequisite shape.** A tree with cross-branch `after` edges, checked for cycles.
- **Skippable primers.** Reading binary is the first. Others are listed per plan.
- **Path size.** 6 to 10 teaching cards, two to four skills on the main line, at least three drills per skill.

## 8. Review model

- **Review cadence.** Attempts replayed in `(at, id)` order, counting only the first attempt per question per day (`src/lib/domain/srs.ts`).
- **Checkpoint shape.** `EXAM_SIZE` is 5. A pool of 5 or fewer shows every item every sitting, which is why the pool-overlap rule exists. One debugging item per checkpoint.

## 9. Sourcing and legal

The repo is public. Wording is original. No text from books, courses or other apps. No screenshots from other apps.

## 10. Writers and reviewers

The owner sets the model per task. Content writers and reviewers are the strongest available model at high effort, each in a fresh context, and the reviewer is a different agent from the writer. Read-only code reviewers use a different model from the writer.

## 11. Pieces coupled to this subject

For the second-subject test (#169, step 4), these are what a new profile may break:

| Piece | Where | Coupling |
| --- | --- | --- |
| `code` field on questions | `src/lib/content/schema.ts` | A code snippet is a first-class field. Languages could use it for sentences, with different meaning |
| `sequence` with `kind: array` or `string` | `schema.ts` | One cell per value or character, at most 8 for drag and trace |
| `pointers`, `markers`, `misses` by index | `schema.ts` | Assume positions in a sequence |
| Tag list | `src/lib/content/tags.ts` | Algorithm topics only |
| Depth levels | `src/lib/content/curriculum.ts` | Named for interviews |
| Python as oracle | writer and reviewer briefs | Not available for languages or certifications |
| Replay rule | `src/lib/domain/srs.ts` | Tuned for reasoning questions |
