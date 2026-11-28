# Deck roadmap

Where every topic in the `py-coding-challenges` repo stands as a deck. The ordering comes from `interview_prep/curriculum.md` there: Phase 0 (tools), Phase 1 (the diagnostic gaps, in order), Phase 2 (the remaining core), Phase 3 (role-specific, only if interviews call for it).

`src/lib/content/roadmap.test.ts` checks this file against `content/decks/`: every deck that exists must appear below as done, in review, or partial, and every row that names decks must name ones that exist. A row names several decks when several paths cover its topic. Update the table in the same commit that adds or renames a deck.

**Status meanings**

- **done**: shipped, written by running every snippet in Python, and reviewed adversarially (wrong answers, ambiguous wording, weak distractors) with the fixes applied.
- **in review**: the file is in `content/decks/` but its review is not finished.
- **partial**: a shipped deck covers part of the topic. The note says what is missing.
- **planned**: no deck yet. The Deck column is `–`.
- **out of scope**: not a fit for a multiple-choice drill. The note says why.

## Curriculum (`interview_prep/curriculum.md`)

| Source | Topic | Deck | Status |
| --- | --- | --- | --- |
| Phase 0a | Cost accounting and the Python data model | `operation-costs`, `hidden-work`, `names-and-objects` | done |
| Phase 0b | The solve routine (restate, examples, brute force, pattern, trace) | – | planned |
| Phase 1, 1 | Hash maps and prefix sums | `hash-lookups`, `prefix-counts` | done |
| Phase 1, 2 | Sorting and interval sweeps | `sort-order`, `interval-merging`, `event-sweeps`, `greedy-scheduling` | done |
| Phase 1, 3 | BFS and DFS on grids and graphs | `reachability`, `traversal-layers` | partial |
| Phase 1, 4 | Binary search, including on the answer | `exact-search`, `boundary-search`, `feasible-limits` | done |
| Phase 1, 5 | Monotonic stack | `monotonic-stack` | done |
| Phase 1, 6 | One-dimensional dynamic programming | `repeated-states`, `one-dimensional-tables`, `dp-storage`, `method-selection` | done |
| Phase 2, 7 | Two pointers and sliding window | `pointer-scans`, `variable-windows`, `window-limits` | done |
| Phase 2, 8 | Heaps and top-K | `heap-operations`, `priority-order`, `bounded-heaps` | done |
| Phase 2, 9 | Linked lists | `link-rewrites`, `pointer-walks` | done |
| Phase 2, 10 | Trees: traversals, BST, recursion | `tree-walks`, `tree-summaries`, `bst-order` | done |
| Phase 2, 11 | Graphs: topological sort, union-find, Dijkstra | `dependency-order`, `connectivity`, `weighted-paths` | done |
| Phase 2, 12 | Recursion and backtracking | `recursive-calls`, `search-state`, `enumerating-choices` | done |
| Phase 2, 13 | Two-dimensional DP and greedy | `grid-tables`, `subsequence-tables`, `dp-storage`, `greedy-choices` | done |
| Phase 3 | Python practical coding (LRU cache, rate limiter, aggregation, asyncio) | – | planned |
| Phase 3 | AI-role topics (ML fundamentals, embeddings, LLM system design) | – | planned |

Topic 3 is partial because the deck covers grids. Graph traversal on adjacency lists (cloning, cycle detection) comes with topic 11.

## Decks that are not one curriculum topic

| Source | Topic | Deck | Status |
| --- | --- | --- | --- |
| Diagnostic | Choosing a pattern from a problem statement (sliding window, two pointers, prefix sums, binary search) | `method-selection`, `hidden-work`, `prefix-counts` | done |
| Diagnostic | Reading time and space complexity off short code | `growth-rates`, `operation-costs` | done |

## `fundamental_concepts/` notebooks

| Source | Topic | Deck | Status |
| --- | --- | --- | --- |
| 001 arrays | Arrays | – | planned |
| 002 hash maps | Hash maps | `hash-lookups`, `prefix-counts` | done |
| 003 sorting | Sorting | `sort-order`, `interval-merging`, `event-sweeps`, `greedy-scheduling` | partial |
| 004 string manipulation | Strings | – | planned |
| 005 greedy algorithms | Greedy | `grid-tables`, `subsequence-tables`, `dp-storage`, `greedy-choices` | partial |
| 006 search | Search | `exact-search`, `boundary-search`, `feasible-limits` | partial |
| 007 dynamic programming | Dynamic programming | `repeated-states`, `one-dimensional-tables`, `dp-storage`, `method-selection` | partial |
| 008 stacks and queues | Stacks and queues | `monotonic-stack` | partial |
| 009 heaps | Heaps | `heap-operations`, `priority-order`, `bounded-heaps` | done |
| 010 graphs | Graphs | `dependency-order`, `connectivity`, `weighted-paths` | done |
| 011 linked lists | Linked lists | `link-rewrites`, `pointer-walks` | done |
| 011 trees | Trees | `tree-walks`, `tree-summaries`, `bst-order` | partial |
| 012 recursion and backtracking | Recursion and backtracking | `recursive-calls`, `search-state`, `enumerating-choices` | done |
| 013 bit manipulation | Bit manipulation | `bit-manipulation` | done |

Bit manipulation was out of scope (the source curriculum gives it one cheat-sheet page). It came into the mastery tree as the Bit manipulation path on #64.

## `fundamental_algorithms/` notebooks

| Source | Topic | Deck | Status |
| --- | --- | --- | --- |
| 001 binary search | Binary search | `exact-search`, `boundary-search`, `feasible-limits` | done |
| 002 DFS | Depth-first search | `reachability`, `traversal-layers` | partial |
| 003 BFS | Breadth-first search | `reachability`, `traversal-layers` | partial |
| 004 sliding window | Sliding window | `pointer-scans`, `variable-windows`, `window-limits` | done |

## `cracking_the_coding_interview/`

Only chapters 1 and 2 are in the repo so far (12 problems).

| Source | Topic | Deck | Status |
| --- | --- | --- | --- |
| Chapter 1 | Arrays and strings (unique, permutation, URLify, palindrome permutation, one away, compression, rotate matrix, zero matrix, string rotation) | – | planned |
| Chapter 2 | Linked lists (remove duplicates, kth to last, delete middle node) | `link-rewrites`, `pointer-walks` | partial |

## `custom_challenges/`

| Source | Topic | Deck | Status |
| --- | --- | --- | --- |
| cc_001 | Maze traversal | `reachability`, `traversal-layers` | partial |
| cc_002 | Connected sinks in a pipe system (grid components) | `reachability`, `traversal-layers` | partial |
| cc_003 | Missing integer | – | planned |
| cc_004 | Monte Carlo statistics aggregation (data analysis task) | – | out of scope |
| cc_005 | Xs and Os (three in a row) | – | out of scope |
| cc_006 | Majority password detection | `hash-lookups`, `prefix-counts` | partial |
| cc_007 | Software scheduler (non-overlapping time slots) | `sort-order`, `interval-merging`, `event-sweeps`, `greedy-scheduling` | partial |

Challenges marked out of scope are implementation or data tasks rather than decisions a quiz can test. cc_004 belongs with the statistics topic below if a deck is written for it.

## Other

| Source | Topic | Deck | Status |
| --- | --- | --- | --- |
| `machine_learning_engineering_prep/` | Statistics crash course | – | planned |

## Mastery curriculum ([#9](https://github.com/knakamura13/facet-learning/issues/9))

New decks written for a skill path in the mastery tree. Each path splits into teaching cards (worked example, then one decision), review variants on fresh inputs, and a checkpoint pool whose inputs appear nowhere else.

| Source | Topic | Deck | Status |
| --- | --- | --- | --- |
| Foundations #10 | Arrays and strings: teaching levels | `arrays-and-strings` | done |
| Foundations #10 | Arrays and strings: review variants | `arrays-and-strings-review` | done |
| Foundations #10 | Arrays and strings: checkpoint | `arrays-and-strings-checkpoint` | done |
| Foundations #10 | Names and objects: teaching levels | `names-and-objects` | done |
| Foundations #10 | Names and objects: review variants | `names-and-objects-review` | done |
| Foundations #10 | Names and objects: checkpoint | `names-and-objects-checkpoint` | done |
| Foundations #10 | Problem-solving routine: teaching levels | `problem-solving-routine` | done |
| Foundations #10 | Problem-solving routine: review variants | `problem-solving-routine-review` | done |
| Foundations #10 | Problem-solving routine: checkpoint | `problem-solving-routine-checkpoint` | done |
| Foundations #10 | Growth rates: teaching levels | `growth-rates` | done |
| Foundations #10 | Growth rates: review variants | `growth-rates-review` | done |
| Foundations #10 | Growth rates: checkpoint | `growth-rates-checkpoint` | done |
| Foundations #10 | Operation costs: teaching levels | `operation-costs` | done |
| Foundations #10 | Operation costs: review variants | `operation-costs-review` | done |
| Foundations #10 | Operation costs: checkpoint | `operation-costs-checkpoint` | done |
| Foundations #10 | Hidden work: teaching levels | `hidden-work` | done |
| Foundations #10 | Hidden work: review variants | `hidden-work-review` | done |
| Foundations #10 | Hidden work: checkpoint | `hidden-work-checkpoint` | done |
| Foundations #10 | Bit manipulation: teaching levels | `bit-manipulation` | done |
| Foundations #10 | Bit manipulation: review variants | `bit-manipulation-review` | done |
| Foundations #10 | Bit manipulation: checkpoint | `bit-manipulation-checkpoint` | done |
| Sequences and search #11 | Pointer scans: teaching levels | `pointer-scans` | done |
| Sequences and search #11 | Pointer scans: review variants | `pointer-scans-review` | done |
| Sequences and search #11 | Pointer scans: checkpoint | `pointer-scans-checkpoint` | done |
| Sequences and search #11 | Palindromes: teaching levels | `palindromes` | done |
| Sequences and search #11 | Palindromes: review variants | `palindromes-review` | done |
| Sequences and search #11 | Palindromes: checkpoint | `palindromes-checkpoint` | done |
| Sequences and search #11 | Grid indices: teaching levels | `grid-indices` | done |
| Sequences and search #11 | Grid indices: review variants | `grid-indices-review` | done |
| Sequences and search #11 | Grid indices: checkpoint | `grid-indices-checkpoint` | done |
| Sequences and search #11 | Substring search: teaching levels | `substring-search` | done |
| Sequences and search #11 | Substring search: review variants | `substring-search-review` | done |
| Sequences and search #11 | Substring search: checkpoint | `substring-search-checkpoint` | done |
| Sequences and search #11 | Exact search: teaching levels | `exact-search` | done |
| Sequences and search #11 | Exact search: review variants | `exact-search-review` | done |
| Sequences and search #11 | Exact search: checkpoint | `exact-search-checkpoint` | done |
| Sequences and search #11 | Hash lookups: teaching levels | `hash-lookups` | done |
| Sequences and search #11 | Hash lookups: review variants | `hash-lookups-review` | done |
| Sequences and search #11 | Hash lookups: checkpoint | `hash-lookups-checkpoint` | done |
| Sequences and search #11 | Sort order: teaching levels | `sort-order` | done |
| Sequences and search #11 | Sort order: review variants | `sort-order-review` | done |
| Sequences and search #11 | Sort order: checkpoint | `sort-order-checkpoint` | done |
| Sequences and search #11 | Prefix counts: teaching levels | `prefix-counts` | done |
| Sequences and search #11 | Prefix counts: review variants | `prefix-counts-review` | done |
| Sequences and search #11 | Prefix counts: checkpoint | `prefix-counts-checkpoint` | done |
| Sequences and search #11 | Boundary search: teaching levels | `boundary-search` | done |
| Sequences and search #11 | Boundary search: review variants | `boundary-search-review` | done |
| Sequences and search #11 | Boundary search: checkpoint | `boundary-search-checkpoint` | done |
| Sequences and search #11 | Interval merging: teaching levels | `interval-merging` | done |
| Sequences and search #11 | Interval merging: review variants | `interval-merging-review` | done |
| Sequences and search #11 | Interval merging: checkpoint | `interval-merging-checkpoint` | done |
| Sequences and search #11 | Event sweeps: teaching levels | `event-sweeps` | done |
| Sequences and search #11 | Event sweeps: review variants | `event-sweeps-review` | done |
| Sequences and search #11 | Event sweeps: checkpoint | `event-sweeps-checkpoint` | done |
| Sequences and search #11 | Feasible limits: teaching levels | `feasible-limits` | done |
| Sequences and search #11 | Feasible limits: review variants | `feasible-limits-review` | done |
| Sequences and search #11 | Feasible limits: checkpoint | `feasible-limits-checkpoint` | done |
| Sequences and search #11 | Variable windows: teaching levels | `variable-windows` | done |
| Sequences and search #11 | Variable windows: review variants | `variable-windows-review` | done |
| Sequences and search #11 | Variable windows: checkpoint | `variable-windows-checkpoint` | done |
| Sequences and search #11 | Window limits: teaching levels | `window-limits` | done |
| Sequences and search #11 | Window limits: review variants | `window-limits-review` | done |
| Sequences and search #11 | Window limits: checkpoint | `window-limits-checkpoint` | done |
| Data structures #12 | Stack matching: teaching levels | `stack-matching` | done |
| Data structures #12 | Stack matching: review variants | `stack-matching-review` | done |
| Data structures #12 | Stack matching: checkpoint | `stack-matching-checkpoint` | done |
| Data structures #12 | Link rewrites: teaching levels | `link-rewrites` | done |
| Data structures #12 | Link rewrites: review variants | `link-rewrites-review` | done |
| Data structures #12 | Link rewrites: checkpoint | `link-rewrites-checkpoint` | done |
| Problem-solving patterns #14 | Recursion: teaching levels | `recursive-calls` | done |
| Problem-solving patterns #14 | Recursion: review variants | `recursive-calls-review` | done |
| Problem-solving patterns #14 | Recursion: checkpoint | `recursive-calls-checkpoint` | done |
| Problem-solving patterns #14 | Backtracking: teaching levels | `search-state` | done |
| Problem-solving patterns #14 | Backtracking: review variants | `search-state-review` | done |
| Problem-solving patterns #14 | Backtracking: checkpoint | `search-state-checkpoint` | done |
| Problem-solving patterns #14 | Greedy choices: teaching levels | `greedy-choices` | done |
| Problem-solving patterns #14 | Greedy choices: review variants | `greedy-choices-review` | done |
| Problem-solving patterns #14 | Greedy choices: checkpoint | `greedy-choices-checkpoint` | done |
| Problem-solving patterns #14 | Memoization: teaching levels | `repeated-states` | done |
| Problem-solving patterns #14 | Memoization: review variants | `repeated-states-review` | done |
| Problem-solving patterns #14 | Memoization: checkpoint | `repeated-states-checkpoint` | done |
| Problem-solving patterns #14 | Method selection: teaching levels | `method-selection` | done |
| Problem-solving patterns #14 | Method selection: review variants | `method-selection-review` | done |
| Problem-solving patterns #14 | Method selection: checkpoint | `method-selection-checkpoint` | done |
| Problem-solving patterns #14 | DP: saving space (teaching levels) | `dp-storage` | done |
| Problem-solving patterns #14 | DP: saving space (review variants) | `dp-storage-review` | done |
| Problem-solving patterns #14 | DP: saving space (checkpoint) | `dp-storage-checkpoint` | done |
| Problem-solving patterns #14 | Dynamic programming: grids (teaching levels) | `grid-tables` | done |
| Problem-solving patterns #14 | Dynamic programming: grids (review variants) | `grid-tables-review` | done |
| Problem-solving patterns #14 | Dynamic programming: grids (checkpoint) | `grid-tables-checkpoint` | done |
| Problem-solving patterns #14 | Greedy scheduling: teaching levels | `greedy-scheduling` | done |
| Problem-solving patterns #14 | Greedy scheduling: review variants | `greedy-scheduling-review` | done |
| Problem-solving patterns #14 | Greedy scheduling: checkpoint | `greedy-scheduling-checkpoint` | done |
| Problem-solving patterns #14 | Dynamic programming: 1D tables (teaching levels) | `one-dimensional-tables` | done |
| Problem-solving patterns #14 | Dynamic programming: 1D tables (review variants) | `one-dimensional-tables-review` | done |
| Problem-solving patterns #14 | Dynamic programming: 1D tables (checkpoint) | `one-dimensional-tables-checkpoint` | done |
| Problem-solving patterns #14 | Dynamic programming: two strings (teaching levels) | `subsequence-tables` | done |
| Problem-solving patterns #14 | Dynamic programming: two strings (review variants) | `subsequence-tables-review` | done |
| Problem-solving patterns #14 | Dynamic programming: two strings (checkpoint) | `subsequence-tables-checkpoint` | done |
| Problem-solving patterns #14 | Backtracking: subsets and orderings (teaching levels) | `enumerating-choices` | done |
| Problem-solving patterns #14 | Backtracking: subsets and orderings (review variants) | `enumerating-choices-review` | done |
| Problem-solving patterns #14 | Backtracking: subsets and orderings (checkpoint) | `enumerating-choices-checkpoint` | done |
| Data structures #12 | Priority order: teaching levels | `priority-order` | done |
| Data structures #12 | Priority order: review variants | `priority-order-review` | done |
| Data structures #12 | Priority order: checkpoint | `priority-order-checkpoint` | done |
| Data structures #12 | Monotonic stack: teaching levels | `monotonic-stack` | done |
| Data structures #12 | Monotonic stack: review variants | `monotonic-stack-review` | done |
| Data structures #12 | Monotonic stack: checkpoint | `monotonic-stack-checkpoint` | done |
| Data structures #12 | Pointer walks: teaching levels | `pointer-walks` | done |
| Data structures #12 | Pointer walks: review variants | `pointer-walks-review` | done |
| Data structures #12 | Pointer walks: checkpoint | `pointer-walks-checkpoint` | done |
| Data structures #12 | Design structures: teaching levels | `design-structures` | done |
| Data structures #12 | Design structures: review variants | `design-structures-review` | done |
| Data structures #12 | Design structures: checkpoint | `design-structures-checkpoint` | done |
| Data structures #12 | Heap operations: teaching levels | `heap-operations` | done |
| Data structures #12 | Heap operations: review variants | `heap-operations-review` | done |
| Data structures #12 | Heap operations: checkpoint | `heap-operations-checkpoint` | done |
| Data structures #12 | Bounded heaps: teaching levels | `bounded-heaps` | done |
| Data structures #12 | Bounded heaps: review variants | `bounded-heaps-review` | done |
| Data structures #12 | Bounded heaps: checkpoint | `bounded-heaps-checkpoint` | done |
| Trees and graphs #13 | Reachability | `reachability` | done |
| Trees and graphs #13 | Reachability: review | `reachability-review` | done |
| Trees and graphs #13 | Reachability: checkpoint | `reachability-checkpoint` | done |
| Trees and graphs #13 | Traversal layers | `traversal-layers` | done |
| Trees and graphs #13 | Traversal layers: review | `traversal-layers-review` | done |
| Trees and graphs #13 | Traversal layers: checkpoint | `traversal-layers-checkpoint` | done |
| Trees and graphs #13 | Dependency order | `dependency-order` | done |
| Trees and graphs #13 | Dependency order: review | `dependency-order-review` | done |
| Trees and graphs #13 | Dependency order: checkpoint | `dependency-order-checkpoint` | done |
| Trees and graphs #13 | Connectivity | `connectivity` | done |
| Trees and graphs #13 | Connectivity: review | `connectivity-review` | done |
| Trees and graphs #13 | Connectivity: checkpoint | `connectivity-checkpoint` | done |
| Trees and graphs #13 | Tree walks | `tree-walks` | done |
| Trees and graphs #13 | Tree walks: review | `tree-walks-review` | done |
| Trees and graphs #13 | Tree walks: checkpoint | `tree-walks-checkpoint` | done |
| Trees and graphs #13 | BST order | `bst-order` | done |
| Trees and graphs #13 | BST order: review | `bst-order-review` | done |
| Trees and graphs #13 | BST order: checkpoint | `bst-order-checkpoint` | done |
| Trees and graphs #13 | Tree summaries | `tree-summaries` | done |
| Trees and graphs #13 | Tree summaries: review | `tree-summaries-review` | done |
| Trees and graphs #13 | Tree summaries: checkpoint | `tree-summaries-checkpoint` | done |
| Trees and graphs #13 | Tree answers | `tree-answers` | done |
| Trees and graphs #13 | Tree answers: review | `tree-answers-review` | done |
| Trees and graphs #13 | Tree answers: checkpoint | `tree-answers-checkpoint` | done |
| Trees and graphs #13 | Tries | `tries` | done |
| Trees and graphs #13 | Tries: review | `tries-review` | done |
| Trees and graphs #13 | Tries: checkpoint | `tries-checkpoint` | done |
| Trees and graphs #13 | Weighted paths | `weighted-paths` | done |
| Trees and graphs #13 | Weighted paths: review | `weighted-paths-review` | done |
| Trees and graphs #13 | Weighted paths: checkpoint | `weighted-paths-checkpoint` | done |
| Trees and graphs #13 | Minimum spanning trees | `spanning-trees` | done |
| Trees and graphs #13 | Minimum spanning trees: review | `spanning-trees-review` | done |
| Trees and graphs #13 | Minimum spanning trees: checkpoint | `spanning-trees-checkpoint` | done |
