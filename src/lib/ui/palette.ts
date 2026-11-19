/**
 * The colors canvas code needs as values. CSS reads the same colors as custom properties from
 * `theme.css`, and `palette.test.ts` keeps the two in step.
 */

export const COLORS = {
	bg: '#060a14',
	ink: '#e8eef8',
	muted: '#8d9ab0',
	faint: '#5b6880',
	gold: '#f6c860',
	rose: '#fb7185',
	ok: '#5eead4'
} as const;

/** One color per curriculum branch, keyed by branch id. `role-specific` is the planned branch. */
export const BRANCH_COLORS = {
	foundations: '#5eead4',
	'sequences-and-search': '#fbbf24',
	'data-structures': '#93c5fd',
	'trees-and-graphs': '#a3e635',
	'problem-solving-patterns': '#c4b5fd',
	'role-specific': '#fda4af'
} as const;

export type BranchId = keyof typeof BRANCH_COLORS;

/** A branch id this file does not know gets a neutral slate. */
export const FALLBACK_BRANCH_COLOR = '#cbd5e1';

export function branchColor(id: string): string {
	return (BRANCH_COLORS as Record<string, string>)[id] ?? FALLBACK_BRANCH_COLOR;
}

/** `#rrggbb` plus an alpha, as `rgba(...)`. */
export function hexA(hex: string, alpha: number): string {
	const n = parseInt(hex.slice(1), 16);
	return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
}
