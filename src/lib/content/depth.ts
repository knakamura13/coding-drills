import type { Curriculum } from './curriculum.ts';

/**
 * How deep an item goes, shallowest first. A learner sees every item at or
 * below the level they choose (#155). Keep the order when adding a level.
 *
 * No zod here, so client pages and preferences can import the levels without
 * pulling in the schema.
 */
export const DEPTHS = ['interview', 'deep'] as const;
export type Depth = (typeof DEPTHS)[number];

/** The depth of a path that does not set one, and of a question the depth map leaves out. A skill or drill without one takes its parent's. */
export const DEFAULT_DEPTH: Depth = DEPTHS[0];

/** Question id to depth, for questions deeper than `DEFAULT_DEPTH` only (`virtual:depths`). */
export type DepthMap = Readonly<Record<string, Depth>>;

/** The level a learner who has not picked one sees. Deep until the Settings control ships (#155). */
export const DEFAULT_LEVEL: Depth = 'deep';

/** Whether a stored value is a depth level (preferences are read from localStorage). */
export function isDepth(value: unknown): value is Depth {
	return typeof value === 'string' && (DEPTHS as readonly string[]).includes(value);
}

/** Whether an item at depth `item` shows to a learner at `level`. */
export function visibleAt(item: Depth, level: Depth): boolean {
	return DEPTHS.indexOf(item) <= DEPTHS.indexOf(level);
}

/** Question id to depth, for every drill deeper than `DEFAULT_DEPTH` (the `virtual:depths` module). */
export function depthMap(curriculum: Curriculum): DepthMap {
	const map: Record<string, Depth> = {};
	for (const drill of curriculum.drills) {
		if (drill.depth !== DEFAULT_DEPTH) map[drill.questionId] = drill.depth;
	}
	return map;
}
