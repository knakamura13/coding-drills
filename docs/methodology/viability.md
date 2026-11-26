# Viability screen

A quick test of whether a subject can work as a curriculum in this app, run before any profile or plan is written. It takes about ten minutes and ends in one of three verdicts. Its purpose is to rule subjects out cheaply, and to say what to cut from a subject that is only partly viable.

A screen is not a plan. A subject that passes is not scheduled, and a subject that fails can be revisited if the app gains a new format.

## What the app does well

Each card asks the learner to produce one decision (pick, tap, place or trace), the app checks it, and explains why each wrong answer fails. Skills form a tree, and a skill unlocks only after the skills it needs are mastered. The scheduler replays an attempt log. A subject is viable to the extent that it fits that shape.

## 1. Hard gates

A subject must pass all six for its core. A gate failed by only part of the subject narrows the scope (see section 3).

| Gate | Pass when | Fails when |
| --- | --- | --- |
| **G1. Skill tree** | The subject splits into branches off a small shared hub, and each branch is an ordered ladder where every skill uses only what earlier skills taught. A path may need a skill from another branch when the edge is named and the graph has no cycle | Topics are a flat list with no order, every topic needs every other topic, or the cross-branch edges form a cycle |
| **G2. Oracle** | The core facts can be checked by something other than a writer's memory: a runtime, a script, a standard, or one authoritative reference | Correctness is a matter of taste, interpretation or contested sources |
| **G3. One decision per card** | A card can ask one decision, the learner produces the answer, and each wrong answer shows a nameable misconception | Questions are only "do you remember this fact", or good answers are open-ended |
| **G4. Stable** | A card stays correct for years, or its shelf life is known and a trigger re-checks it | Facts change faster than content can be reviewed |
| **G5. Modality** | The core can be learned with what the app can show and take: text, symbols, diagrams, taps, drags and traces | The core needs speech, listening, handwriting, drawing or physical practice, and no recorded asset is available |
| **G6. Original wording** | Cards can be written from scratch, without copying a source's text, questions or exam items | The value of the subject is a specific copyrighted text or a leaked question bank |

## 2. Scored signals

Score each signal 0 (bad), 1 (mixed) or 2 (good). These do not rule a subject out. They shape the plan and the cost.

| Signal | 2 means | 0 means |
| --- | --- | --- |
| **Reasoning, not recall** | Most skills are "apply a rule to a new case" | Most skills are "remember this item" |
| **Representation** | A built format shows the subject's objects (a sequence, a grid, a staff, a state) | The objects need a format that does not exist |
| **Branch independence** | Few cross-branch prerequisites, each named, so branches can be written and reviewed separately | Branches need each other so often that the tree is mostly a chain |
| **Explanation depth** | Every wrong answer has a distinct cause | Wrong answers are just "not the one" |
| **Reviewer availability** | An agent can review everything the oracle covers | Core claims need a named human expert |
| **Scope size** | One to six branches of six to ten cards per path | Hundreds of items or a few dozen cards |
| **Existing demand** | Learners already ask for it | No evidence anyone wants a quiz on it |

## 3. Verdicts

1. **Likely viable.** All six gates pass for the core. Total score 9 or more of 14. Proceed to a subject profile.
2. **Viable, scoped.** One or more gates fail for part of the subject. Name the part that passes (the *core*) and the part that does not (the *excluded*). Proceed with the core only. The excluded part is not a later phase: list it with the missing capability that would be required (a new format, audio, a human reviewer).
3. **Likely non-viable.** The core fails G1, G2 or G3, or fails two or more gates in total, or scores under 6. Record the reason and stop.

When unsure whether a gate passes, test it: write three cards for the subject's most typical skill, with their wrong answers and follow-ups. If a card needs "it depends", or a wrong answer has no cause, G3 fails.

## 4. Recording a screen

Write it as `viability-<subject>.md` or in the issue for the subject. Keep it to one page.

```
# Viability: <subject>

Verdict: likely viable | viable, scoped | likely non-viable
Core: <what passes>
Excluded: <what does not, and what it would need>

| Gate | Pass | Note (one line) |
| G1 .. G6 |

| Signal | Score | Note |

Test cards written: <yes, three cards for skill X | no>
Open questions: <only what would change the verdict>
```

## 5. Worked examples

These show the method. They are screens, not plans, and none is scheduled.

**Coding interviews (the built subject). Likely viable.** G1 pass: five branches off a foundations hub, with a few named cross-branch prerequisites (for example a search path that needs greedy choices from the patterns branch) and no cycle. G2 pass: a Python runtime checks every value. G3 pass: each wrong option maps to a bug or misconception. G4 pass. G5 pass: arrays and graphs draw as text and cells. G6 pass. Signals strong except the missing typed-entry format.

**A spoken language's script and grammar rules (Korean as the example). Viable, scoped.**
- Core: writing system, sound-change rules, particles, verb conjugation, numbers and counters. A script can check all of it (G2), and each is a rule applied to a new case (G3).
- Excluded: listening and pronunciation (G5, needs recorded audio), vocabulary as a list (G3, recall, needs a different review rule), idioms and natural phrasing (G2, needs a native reviewer).
- Cost to notice: every word a card uses must be taught earlier, so the subject needs a controlled lexicon.

**A country's history (Korean history as the example). Likely non-viable as a tree.**
- G1 fails: events interleave, and no branch is a ladder of skills that unlock each other.
- G3 fails for the core: questions are recall ("when did X happen"), and a wrong answer rarely has a distinct misconception.
- G2 is weak: causes and significance are contested, and sources disagree.
- A narrow part, such as ordering events on a timeline, could pass G3, but that is a feature, not a curriculum.

**A programming language (JavaScript). Likely viable.** The same shape as the built subject, with a different runtime as the oracle.

**A certification (cloud or security exam). Viable, scoped.** The blueprint gives the branches (G1) and scenario questions fit G3. G6 is the limit: items must be original and must not come from exam dumps. G4 needs a re-check when the vendor releases a new exam version.

**Music theory (intervals, scales, chords, key signatures). Likely viable.** Rules are checkable, a staff or keyboard is a natural representation, and the formats need a new visual. Ear training is excluded (G5).

**Creative writing. Likely non-viable.** Fails G2 and G3: quality is judged by taste and every good answer is open-ended.
