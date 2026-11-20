/**
 * The colors canvas code needs as values. They come from the generated `tokens.ts`; CSS reads the
 * same values as custom properties from `tokens.css`, and `tokens.test.ts` keeps both in step with
 * design/tokens.json.
 */

import { ACCENTS, BRANCH_COLORS, ROLE } from './tokens';

export { BRANCH_COLORS, ROLE };

export type BranchId = keyof typeof BRANCH_COLORS;

/** A branch id this file does not know, or a screen with no branch, gets the neutral accent. */
export const FALLBACK_BRANCH_COLOR: string = ACCENTS.none.base;

export function branchColor(id: string): string {
	return (BRANCH_COLORS as Record<string, string>)[id] ?? FALLBACK_BRANCH_COLOR;
}

/** `#rrggbb` plus an alpha, as `rgba(...)`. */
export function hexA(hex: string, alpha: number): string {
	const n = parseInt(hex.slice(1), 16);
	return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
}
