# Pipeline

The steps from a subject to merged decks. Extracted from how the coding-interview curriculum was built (issues #9, #95, #154). Each step has an input, an output and a gate. Agents do the work, and the owner decides the product calls. Rules referenced as "rule N" are in [`README.md`](README.md) section 2.

## 0. Screen and profile

Run the [viability screen](viability.md). A likely non-viable subject stops here. A scoped subject proceeds with its core only. Then fill [`subject-profile.md`](subject-profile.md). **Gate:** the owner approves the screen and the profile. Binding decisions (baseline, audience, depth levels, naming) are recorded here and win over every later document.

## 1. Research scope

Two independent agents, on different models, research what the subject needs, then a third reconciles them. Each cites sources with dates and says which claims are their own judgment. Output: a weighted topic list with a trend per topic and a note on skills beyond topics (for coding, debugging and explaining complexity).

**Gate:** topics the evidence weights high or medium are in the plan or deliberately out of scope with a reason.

## 2. Plan each branch

One read-only planner per branch writes a plan from the planner brief below. Per path it covers prerequisites, the teaching deck as a sequence, the review deck, the checkpoint deck, terms, cross-branch moves and leftovers from older material.

## 3. Reconcile

One agent merges the branch plans into one document: the prerequisite graph with a cycle check, cross-branch decisions, the term table with owners, counts, and questions for the owner. Plans disagree, so the reconciled document states which wins. Owner answers sit at the top and win over everything below.

## 4. Verify the plan

An adversarial agent checks every factual claim a decision rests on ("no card teaches X", "term T is first defined in Y") against the repo, and reads at least one deck per path itself. A wrong claim becomes a wrong rewrite, so this step runs before any writing.

**Gate:** wrong claims are fixed in the reconciled document as amendments.

## 5. Coverage audit

A separate agent builds its own topic list and checks the plan against it. Output: gaps with a proposed placement (a skill, a path, or out of scope).

## 6. Write

One writer per path or branch, in its own worktree, from the writer brief below. A writer finishes with the tests passing, one check file per deck that proves every stated fact against the oracle, and one commit. Writers check every question against the miss catalog.

## 7. Review

A different agent reviews adversarially from the reviewer brief below. It is read-only and reports each finding with a severity and an exact replacement. For a multi-branch batch, one final reviewer looks for problems that repeat across branches.

## 8. Fix

Reproduce each finding with the oracle before changing anything. Fix it, or reject it with the output that shows the reviewer was wrong. A fix that changes what a checkpoint item tests waits for the owner. At most two rounds. What remains goes to the owner.

## 9. Pull request

One PR per branch. The body says what was reviewed and by whom, then lists findings as fixed, not applied, or needing a decision. Changed cards get before and after screenshots.

## 10. Record misses

The ledger holds two records, added once the owner approves. **Escapes** are problems found after review, by an external reviewer, the owner or a learner flag. **Writer misses** are kinds of problem reviewers caught, counted across PRs. A kind seen in two or more PRs becomes a catalog entry that writers and reviewers check against. Merge near-twins, since a long catalog dilutes attention.

---

## Brief templates

Fill the bracketed parts from the profile. Keep each brief self-contained: an agent knows only what the brief tells it.

### Planner brief (one branch, read-only)

```
You plan one curriculum branch of [product] so its lessons progress from the
first card to the last. Read-only: write one plan file, change nothing else.

Context: [one paragraph: what the product is, how a deck is played, the
learner baseline and audience from the profile]. Binding decisions: [list from
the profile and the owner's answers].

Read first: the authoring guide, the schema, the miss catalog, every other
branch's curriculum file (your paths' prerequisites cross branches).

For every path in prerequisite order:
1. Prerequisites. Is `after` right? List every card leaning on something no
   earlier card or prerequisite teaches.
2. Teaching deck as a sequence. Per card: "Given that the learner can already
   ___, this card asks them to infer ___", plus a verdict (keep, rewrite,
   split, supply a prerequisite, drop, move). Propose the order and new cards.
   Draft the first card's worked example in full. Each skill keeps at least
   three drills. Aim for [6 to 10] teaching cards per path.
3. Review deck: each card checks a taught skill on new values, no scaffolding.
4. Checkpoint deck: each item combines skills on new values and cannot be
   answered from memory.
5. Terms: where each is first defined, and every use before that.
6. Cross-branch moves and leftovers from older material.

Output: summary (at most 8 lines), a counts table, then per-path sections,
a terms table, a leftovers table, and questions for the owner. Only list
questions you cannot settle from the brief.
```

### Verifier brief (adversarial, read-only)

```
You check plans written by other agents. Find what is wrong, not what is fine.
For every claim a decision rests on, check it against the repo, searching the
whole curriculum. Flag decisions that do not follow from true reasons. Read
at least one deck per path in file order and list problems the plan missed.
Flag anything that contradicts the binding decisions.
Report: numbered findings of type wrong claim, weak decision, missed, or
contradicts owner, with evidence and the replacement text. Problems only.
```

### Writer brief

```
You write or change deck content in the worktree and decks named below.
Read first: the authoring guide, the schema, the miss catalog.
For each question: read all of it; compute every stated value with the
[oracle] into a check file per deck, one assertion per claim, each commented
with the question id; compare every added input against the answer and the
options; make every general rule hold for every case; keep options parallel;
write original wording.
Finish: tests pass, check files pass, one commit, no push. Report under 300
words: changes per deck, changed values and why, anything wrong outside your
task that you did not fix, the commit SHA.
```

### Reviewer brief

```
You are an independent, adversarial reviewer. Another agent wrote this. Find
what is wrong. Read-only: write one report.
For every question, follow-up, trace step and worked example: recompute every
value independently of the writer; check that every wrong option is wrong
under every reasonable reading; check explanations and follow-ups are true;
check the question stands alone; check for giveaways; check checkpoint items
cannot be answered from memory; check only the named fields changed.
Severity: blocker (marked answer wrong, a wrong option defensibly correct, or
unanswerable), major (false or misleading text, two readings, leaked answer),
minor (giveaways, non-parallel options, style).
Report: numbered findings with the evidence you ran and the exact replacement,
then counts. Problems only.
```
