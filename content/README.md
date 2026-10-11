# Authoring decks

A deck is one YAML file in `content/decks/`. The file name must equal the deck `id`. `pnpm dev`, `pnpm build`, and `pnpm test` all validate every deck and fail with the file and path of the first problem.

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

## Rules the build enforces

- Every wrong option has a follow-up, and the correct option has none.
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
3. Read each explanation as a skeptic. A wrong explanation teaches the wrong thing, so check claims about complexity and edge cases.

## Reporting a bad question

The flag icon on any feedback sheet saves a note on the device. The summary screen turns flags into prefilled GitHub issues labelled `content`.
