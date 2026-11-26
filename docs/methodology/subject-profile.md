# Subject profile template

Copy this page to `profile-<subject>.md` and fill every field. A field the subject cannot fill is a finding: write what is missing and what it blocks. Rules in [`README.md`](README.md) section 2 apply unless a field here states an exception and a reason.

## 0. Viability

Link the subject's [viability screen](viability.md): its verdict, its core and what it excludes. This profile covers the core only.

## 1. Audience and baseline

- **Learner.** Who they are and what they want from the course.
- **Baseline.** What every learner is assumed to know before the first card. Anything beyond it is taught before a card uses it.
- **Target level.** The bar the default depth level aims at, and who it excludes.

## 2. Scope source

- **Source of truth.** The documents or evidence the scope comes from (an exam blueprint, a proficiency framework, a standard syllabus, current practice data). Cite each with its date.
- **Weighting.** How topics are weighted high, medium or low and how the weights are evidenced.
- **Freshness.** How often the scope is re-checked, and the trigger that forces a re-check (a new exam version, a language release).

## 3. Verification oracle

How a stated fact is proven, by the writer and independently by the reviewer.

| Kind of claim | How it is checked | Who can check |
| --- | --- | --- |
| Code output or behavior | A runtime the writer and reviewer can run | Any agent |
| Rule or definition | A named authoritative source | Any agent |
| Usage, naturalness or register | A named human reviewer | Human only |

If a kind of claim has no oracle, say what limits content of that kind.

## 4. Question formats

- **Formats in use.** From the built formats, and any proposed.
- **Representations.** What the learner sees and acts on, per topic (the coding profile's representation table is the model).
- **Modalities.** What the core needs beyond text, symbols and diagrams (audio, handwriting), and where the assets would come from. A core that needs one with no source fails gate G5.
- **Content items.** Whether cards use items that must be introduced in order (words, characters, formulas), and where the controlled list lives.
- **Gaps.** Formats the subject needs that do not exist. Each gap follows the "when a question needs a new format" process in `content/README.md`.

## 5. Vocabulary

- **Tags.** The fixed list, with the reason each exists. Tags drive progress topics and practice filters.
- **Term owners.** Terms that need one defining path, and the path.
- **Naming rules.** House spellings, forms of address, notation, and anything the learner reads on every card.

## 6. Depth axis

The ordered levels, what each means for this subject, and the rule that decides where an item goes.

## 7. Structure

- **Branches.** The top-level split.
- **Prerequisite shape.** Is the subject a tree, a chain or mostly flat? Note any ordering that is pedagogical, not logical.
- **Skippable primers.** Background that many learners already have.
- **Path size.** Teaching cards per path (the coding profile uses 6 to 10).

## 8. Review model

- **Review cadence.** Whether the shared replay rule fits. State the mix of reasoning skills (apply a rule to a new case) and recall skills (remember an item). Recall-heavy material may need a different spacing rule.
- **Checkpoint shape.** Items per sitting, pass rule, and whether a debugging item applies.

## 9. Sourcing and legal

What may and may not be used. Wording rules. Anything the repo being public prevents.

## 10. Writers and reviewers

Which model and effort write and review, who signs off, and what needs a human the agents cannot be.
