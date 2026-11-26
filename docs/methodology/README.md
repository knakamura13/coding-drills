# Curriculum methodology

How a subject becomes a mastery tree of lessons, drills and checkpoint exams. Coding interviews is the first subject. The aim is a method another subject can reuse by filling in a profile, not by copying decisions made for coding. Tracker: #169.

Status: draft for the owner's review. This page, [`pipeline.md`](pipeline.md) and the profile were extracted from the coding-interview curriculum as built. Nothing here has been tested on a second subject, and no second subject is planned. A subject becomes a curriculum only when the owner decides to build it, after it passes the [viability screen](viability.md).

| Page | What it holds |
| --- | --- |
| This page | The core model and the rules that hold for every subject |
| [`viability.md`](viability.md) | A ten-minute screen that rules a subject viable, scoped or non-viable before any planning |
| [`pipeline.md`](pipeline.md) | The steps from scope to merged deck, with brief templates |
| [`subject-profile.md`](subject-profile.md) | The template a new subject fills in |
| [`profile-coding-interviews.md`](profile-coding-interviews.md) | The first filled profile |

## 1. Core model

These parts do not depend on the subject.

- **Attempt log is the truth.** Every answer is an attempt with a stored local `day`. Schedules, skill mastery, exam passing, locking, weak spots and progress are derived by replaying the log. Nothing derived is stored, so a rule change re-derives on every device.
- **Hub and spokes.** A subject has a small shared hub and independent branches off it. Inside a branch the content is a ladder: each skill uses only what earlier skills in the branch, or the hub, taught. Branches share nothing except the hub, so each can be written, reviewed and merged on its own.
- **Tree.** A branch holds paths. A path holds an ordered run of skills (two to four on its main line) and ends in a checkpoint. A path lists the paths it comes `after`. A skill is mastered only while its latest answer on each of at least three drills was right.
- **Three decks per path.** A teaching deck, a review deck (fresh values, no scaffolding) and a checkpoint deck (combines the path's skills, sat as an exam). Every question is mapped to one skill path or the build fails.
- **Question.** One decision per card. The learner produces the answer (pick, tap, place, trace). Every wrong answer is explained in place, and a wrong multiple-choice pick leads to one follow-up aimed at the misconception it shows.
- **Depth.** An ordered level on each path, skill and question. An item may be deeper than its parent, never shallower. Deeper skills never hold something a shallower card relies on. The learner chooses the level they see.
- **Skippable primer.** Background many learners already know goes in its own self-contained skill at the start of a path, so it can be skipped.

## 2. Rules for every subject

1. **One new inference per card.** Finish the sentence: "Given that the learner can already ___, this card asks them to infer ___." If it needs two, split it or supply the prerequisite first.
2. **Nothing relies on what is taught only in a worked example, a follow-up, a review card or a checkpoint card.** Teaching-deck order is the learner's first-run order.
3. **Everything a card uses is taught first.** That covers terms, symbols, notation, operators and, in a language subject, every word. Each is defined once, on a teaching card, before any card relies on it. One idea gets one name across the whole curriculum, and each has an owning path. A subject whose cards use content items (words, characters, formulas) keeps a controlled list of them with the path that introduces each, and a build test rejects a card that uses an item before its introduction.
4. **Every question stands alone.** Answerable and true from what it shows. No prompt or explanation cites the worked example.
5. **Every stated fact is checked by something other than the writer's memory.** The check is the subject's verification oracle (see the profile): a runtime, a script that implements the rules, or a named authoritative reference. A different agent then tries to break the content. A claim that only a human can check (naturalness, register, contested interpretation) needs a named human reviewer, or it stays out of the subject.
6. **Every wrong option is wrong under every reasonable reading**, and none is defensibly correct. A wrong option represents a plausible error. Options are parallel and the right one is not longer or more specific.
7. **A general rule an explanation states holds for every case, or names the case it covers.**
8. **Checkpoint pools do not print each other's answers.** When the pool is no larger than the exam size, every item appears in every sitting, so no item's answer may be printed in another item. A checkpoint item must not be answerable by recalling a teaching card.
9. **A checkpoint has one debugging item** where it fits the subject: a near-miss of the path's own material, asking which part is wrong. The failure must be real, the marked cause the true one, and no other option causes it.
10. **Wording is original.** Nothing is copied from books, courses, other apps or exam dumps. The repo is public.
11. **A question never stays in a deck after it is retired.** It moves with its id to the deck it belongs in, or is deleted with its mapping.
12. **No users means no compatibility work yet.** Ids, history and exam passes need no protection until the app ships. This rule ends at launch and must be revisited then.

## 3. What is subject-specific

Everything below is set in the profile, not here.

- Who the learner is, and what they already know.
- The source of truth for scope, and how scope is weighted.
- The verification oracle for facts.
- Which question formats and representations the subject needs.
- The tag vocabulary and the depth axis.
- Which terms need owners, and the house style for naming.
- Legal and sourcing limits.

## 4. Known gaps

- The code assumes arrays, strings and Python. See [`profile-coding-interviews.md`](profile-coding-interviews.md) for the list of coupled pieces. A second subject profile is the test of which assumptions must move.
- Formats for typed answers, audio and sentence building do not exist. "Entering a value" is already a recorded gap.
- The spaced-review rules in `src/lib/domain/srs.ts` are tuned for reasoning questions. Vocabulary and recall may need a different rule.
