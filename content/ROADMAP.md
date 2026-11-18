# Deck roadmap

Where every topic in the `py-coding-challenges` repo stands as a deck. The ordering comes from `interview_prep/curriculum.md` there: Phase 0 (tools), Phase 1 (the diagnostic gaps, in order), Phase 2 (the remaining core), Phase 3 (role-specific, only if interviews call for it).

`src/lib/content/roadmap.test.ts` checks this file against `content/decks/`: every deck that exists must appear below as done, in review, or partial, and every row that names a deck must name one that exists. Update the table in the same commit that adds or renames a deck.

**Status meanings**

- **done**: shipped, written by running every snippet in Python, and reviewed adversarially (wrong answers, ambiguous wording, weak distractors) with the fixes applied.
- **in review**: the file is in `content/decks/` but its review is not finished.
- **partial**: a shipped deck covers part of the topic. The note says what is missing.
- **planned**: no deck yet. The Deck column is `–`.
- **out of scope**: not a fit for a multiple-choice drill. The note says why.

## Curriculum (`interview_prep/curriculum.md`)

| Source | Topic | Deck | Status |
| --- | --- | --- | --- |
| Phase 0a | Cost accounting and the Python data model | `cost-python-data-model` | done |
| Phase 0b | The solve routine (restate, examples, brute force, pattern, trace) | – | planned |
| Phase 1, 1 | Hash maps and prefix sums | `hash-maps-prefix-sums` | done |
| Phase 1, 2 | Sorting and interval sweeps | `sorting-interval-sweeps` | done |
| Phase 1, 3 | BFS and DFS on grids and graphs | `graph-traversal-grids` | partial |
| Phase 1, 4 | Binary search, including on the answer | `binary-search-on-answer` | done |
| Phase 1, 5 | Monotonic stack | `monotonic-stack` | done |
| Phase 1, 6 | One-dimensional dynamic programming | `one-dimensional-dp` | done |
| Phase 2, 7 | Two pointers and sliding window | `two-pointers-sliding-window` | done |
| Phase 2, 8 | Heaps and top-K | `heaps-top-k` | done |
| Phase 2, 9 | Linked lists | `linked-lists` | done |
| Phase 2, 10 | Trees: traversals, BST, recursion | `trees-traversals-bst` | done |
| Phase 2, 11 | Graphs: topological sort, union-find, Dijkstra | `graph-algorithms` | done |
| Phase 2, 12 | Recursion and backtracking | `recursion-backtracking` | done |
| Phase 2, 13 | Two-dimensional DP and greedy | `two-dimensional-dp-greedy` | done |
| Phase 3 | Python practical coding (LRU cache, rate limiter, aggregation, asyncio) | – | planned |
| Phase 3 | AI-role topics (ML fundamentals, embeddings, LLM system design) | – | planned |

Topic 3 is partial because the deck covers grids. Graph traversal on adjacency lists (cloning, cycle detection) comes with topic 11.

## Decks that are not one curriculum topic

| Source | Topic | Deck | Status |
| --- | --- | --- | --- |
| Diagnostic | Choosing a pattern from a problem statement (sliding window, two pointers, prefix sums, binary search) | `pattern-identification` | done |
| Diagnostic | Reading time and space complexity off short code | `complexity-analysis` | done |
| Demo | Tapping the cell an index or a pointer names | `tap-the-cell` | in review |

## `fundamental_concepts/` notebooks

| Source | Topic | Deck | Status |
| --- | --- | --- | --- |
| 001 arrays | Arrays | – | planned |
| 002 hash maps | Hash maps | `hash-maps-prefix-sums` | done |
| 003 sorting | Sorting | `sorting-interval-sweeps` | partial |
| 004 string manipulation | Strings | – | planned |
| 005 greedy algorithms | Greedy | `two-dimensional-dp-greedy` | partial |
| 006 search | Search | `binary-search-on-answer` | partial |
| 007 dynamic programming | Dynamic programming | `one-dimensional-dp` | partial |
| 008 stacks and queues | Stacks and queues | `monotonic-stack` | partial |
| 009 heaps | Heaps | `heaps-top-k` | done |
| 010 graphs | Graphs | `graph-algorithms` | done |
| 011 linked lists | Linked lists | `linked-lists` | done |
| 011 trees | Trees | `trees-traversals-bst` | partial |
| 012 recursion and backtracking | Recursion and backtracking | `recursion-backtracking` | done |
| 013 bit manipulation | Bit manipulation | – | out of scope |

Bit manipulation is out of scope because the curriculum drops it to a single cheat-sheet page, unless an interview needs it.

## `fundamental_algorithms/` notebooks

| Source | Topic | Deck | Status |
| --- | --- | --- | --- |
| 001 binary search | Binary search | `binary-search-on-answer` | done |
| 002 DFS | Depth-first search | `graph-traversal-grids` | partial |
| 003 BFS | Breadth-first search | `graph-traversal-grids` | partial |
| 004 sliding window | Sliding window | `two-pointers-sliding-window` | done |

## `cracking_the_coding_interview/`

Only chapters 1 and 2 are in the repo so far (12 problems).

| Source | Topic | Deck | Status |
| --- | --- | --- | --- |
| Chapter 1 | Arrays and strings (unique, permutation, URLify, palindrome permutation, one away, compression, rotate matrix, zero matrix, string rotation) | – | planned |
| Chapter 2 | Linked lists (remove duplicates, kth to last, delete middle node) | `linked-lists` | partial |

## `custom_challenges/`

| Source | Topic | Deck | Status |
| --- | --- | --- | --- |
| cc_001 | Maze traversal | `graph-traversal-grids` | partial |
| cc_002 | Connected sinks in a pipe system (grid components) | `graph-traversal-grids` | partial |
| cc_003 | Missing integer | – | planned |
| cc_004 | Monte Carlo statistics aggregation (data analysis task) | – | out of scope |
| cc_005 | Xs and Os (three in a row) | – | out of scope |
| cc_006 | Majority password detection | `hash-maps-prefix-sums` | partial |
| cc_007 | Software scheduler (non-overlapping time slots) | `sorting-interval-sweeps` | partial |

Challenges marked out of scope are implementation or data tasks rather than decisions a quiz can test. cc_004 belongs with the statistics topic below if a deck is written for it.

## Other

| Source | Topic | Deck | Status |
| --- | --- | --- | --- |
| `machine_learning_engineering_prep/` | Statistics crash course | – | planned |

## Mastery curriculum ([#9](https://github.com/knakamura13/coding-drills/issues/9))

New decks written for a skill path in the mastery tree. Each path splits into teaching cards (worked example, then one decision), review variants on fresh inputs, and a checkpoint pool whose inputs appear nowhere else.

| Source | Topic | Deck | Status |
| --- | --- | --- | --- |
| Foundations #10 | Arrays and strings: teaching levels | `arrays-and-strings` | in review |
| Foundations #10 | Arrays and strings: review variants | `arrays-and-strings-review` | in review |
| Foundations #10 | Arrays and strings: checkpoint | `arrays-and-strings-checkpoint` | in review |
| Foundations #10 | Names and objects: teaching levels | `names-and-objects` | in review |
| Foundations #10 | Names and objects: review variants | `names-and-objects-review` | in review |
| Foundations #10 | Names and objects: checkpoint | `names-and-objects-checkpoint` | in review |
| Foundations #10 | Problem-solving routine: teaching levels | `problem-solving-routine` | in review |
| Foundations #10 | Problem-solving routine: review variants | `problem-solving-routine-review` | in review |
| Foundations #10 | Problem-solving routine: checkpoint | `problem-solving-routine-checkpoint` | in review |
| Foundations #10 | Growth rates: teaching levels | `growth-rates` | in review |
| Foundations #10 | Growth rates: review variants | `growth-rates-review` | in review |
| Foundations #10 | Growth rates: checkpoint | `growth-rates-checkpoint` | in review |
| Foundations #10 | Operation costs: teaching levels | `operation-costs` | in review |
| Foundations #10 | Operation costs: review variants | `operation-costs-review` | in review |
| Foundations #10 | Operation costs: checkpoint | `operation-costs-checkpoint` | in review |
| Sequences and search #11 | Pointer scans: teaching levels | `pointer-scans` | in review |
| Sequences and search #11 | Pointer scans: review variants | `pointer-scans-review` | in review |
| Sequences and search #11 | Pointer scans: checkpoint | `pointer-scans-checkpoint` | in review |
| Sequences and search #11 | Pointer scans: dragging the pointers through one step | `drag-the-pointers` | in review |
| Sequences and search #11 | Exact search: teaching levels | `exact-search` | in review |
| Sequences and search #11 | Exact search: review variants | `exact-search-review` | in review |
| Sequences and search #11 | Exact search: checkpoint | `exact-search-checkpoint` | in review |
| Sequences and search #11 | Pointer scans: predicting each step of a scan | `trace-the-scan` | in review |
| Sequences and search #11 | Hash lookups: teaching levels | `hash-lookups` | in review |
| Sequences and search #11 | Hash lookups: review variants | `hash-lookups-review` | in review |
| Sequences and search #11 | Hash lookups: checkpoint | `hash-lookups-checkpoint` | in review |
| Sequences and search #11 | Sort order: teaching levels | `sort-order` | in review |
| Sequences and search #11 | Sort order: review variants | `sort-order-review` | in review |
| Sequences and search #11 | Sort order: checkpoint | `sort-order-checkpoint` | in review |
| Sequences and search #11 | Prefix counts: teaching levels | `prefix-counts` | in review |
| Sequences and search #11 | Prefix counts: review variants | `prefix-counts-review` | in review |
| Sequences and search #11 | Prefix counts: checkpoint | `prefix-counts-checkpoint` | in review |
| Sequences and search #11 | Boundary search: teaching levels | `boundary-search` | in review |
| Sequences and search #11 | Boundary search: review variants | `boundary-search-review` | in review |
| Sequences and search #11 | Boundary search: checkpoint | `boundary-search-checkpoint` | in review |
| Sequences and search #11 | Interval merging: teaching levels | `interval-merging` | in review |
| Sequences and search #11 | Interval merging: review variants | `interval-merging-review` | in review |
| Sequences and search #11 | Interval merging: checkpoint | `interval-merging-checkpoint` | in review |
| Sequences and search #11 | Event sweeps: teaching levels | `event-sweeps` | in review |
| Sequences and search #11 | Event sweeps: review variants | `event-sweeps-review` | in review |
| Sequences and search #11 | Event sweeps: checkpoint | `event-sweeps-checkpoint` | in review |
| Data structures #12 | Stack matching: teaching levels | `stack-matching` | in review |
| Data structures #12 | Stack matching: review variants | `stack-matching-review` | in review |
| Data structures #12 | Stack matching: checkpoint | `stack-matching-checkpoint` | in review |
| Data structures #12 | Link rewrites: teaching levels | `link-rewrites` | in review |
| Data structures #12 | Link rewrites: review variants | `link-rewrites-review` | in review |
| Data structures #12 | Link rewrites: checkpoint | `link-rewrites-checkpoint` | in review |
| Problem-solving patterns #14 | Recursive calls: teaching levels | `recursive-calls` | in review |
| Problem-solving patterns #14 | Recursive calls: review variants | `recursive-calls-review` | in review |
| Problem-solving patterns #14 | Recursive calls: checkpoint | `recursive-calls-checkpoint` | in review |
| Data structures #12 | Priority order: teaching levels | `priority-order` | in review |
| Data structures #12 | Priority order: review variants | `priority-order-review` | in review |
| Data structures #12 | Priority order: checkpoint | `priority-order-checkpoint` | in review |
| Data structures #12 | Monotonic stack: teaching levels | `monotonic-stack-drills` | in review |
| Data structures #12 | Monotonic stack: review variants | `monotonic-stack-review` | in review |
| Data structures #12 | Monotonic stack: checkpoint | `monotonic-stack-checkpoint` | in review |
