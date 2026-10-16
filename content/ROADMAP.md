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

## `fundamental_concepts/` notebooks

| Source | Topic | Deck | Status |
| --- | --- | --- | --- |
| 001 arrays | Arrays | `cost-python-data-model` | done |
| 002 hash maps | Hash maps | `hash-maps-prefix-sums` | done |
| 003 sorting | Sorting | `sorting-interval-sweeps` | done |
| 004 string manipulation | Strings | `two-pointers-sliding-window` | done |
| 005 greedy algorithms | Greedy | `two-dimensional-dp-greedy` | done |
| 006 search | Search | `binary-search-on-answer` | done |
| 007 dynamic programming | Dynamic programming | `one-dimensional-dp` | done |
| 008 stacks and queues | Stacks and queues | `monotonic-stack` | done |
| 009 heaps | Heaps | `heaps-top-k` | done |
| 010 graphs | Graphs | `graph-algorithms` | done |
| 011 linked lists | Linked lists | `linked-lists` | done |
| 011 trees | Trees | `trees-traversals-bst` | done |
| 012 recursion and backtracking | Recursion and backtracking | `recursion-backtracking` | done |
| 013 bit manipulation | Bit manipulation | `cost-python-data-model` | done |

Each row names the deck that holds most of the topic's questions. Several topics also have questions in other decks, which the audit mapped item by item. Bit manipulation is spread over four decks: `cost-python-data-model` (operators, shifts, the `n & (n - 1)` test), `complexity-analysis` (the cost of popcount), `recursion-backtracking` (bitmask subsets), and `pattern-identification` (XOR for the single non-duplicate). It was out of scope until the audit of `fundamental_concepts/` widened the scope to every topic in those notebooks.

## `fundamental_algorithms/` notebooks

| Source | Topic | Deck | Status |
| --- | --- | --- | --- |
| 001 binary search | Binary search | `binary-search-on-answer` | done |
| 002 DFS | Depth-first search | `graph-traversal-grids` | partial |
| 003 BFS | Breadth-first search | `graph-traversal-grids` | partial |
| 004 sliding window | Sliding window | `two-pointers-sliding-window` | done |

DFS is partial because no deck covers Tarjan's strongly connected components. BFS is partial because no deck covers bidirectional BFS. The notebooks name both as variants.

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
