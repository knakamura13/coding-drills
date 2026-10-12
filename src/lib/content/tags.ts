/**
 * The topic tags a question may carry. A fixed list keeps the Progress screen
 * and Mixed practice filter from filling up with near-duplicates ("queue" and
 * "queues", "Bfs"). To add a topic, add it here and give it a label in
 * `src/lib/review/practice.ts` if the default capitalization reads badly.
 */
export const TOPIC_TAGS = [
	'binary-search',
	'bfs',
	'complexity',
	'dfs',
	'dp',
	'grid',
	'hash-map',
	'intervals',
	'prefix-sum',
	'python',
	'queue',
	'recursion',
	'sliding-window',
	'sorting',
	'stack',
	'two-pointers'
] as const;

export type TopicTag = (typeof TOPIC_TAGS)[number];
