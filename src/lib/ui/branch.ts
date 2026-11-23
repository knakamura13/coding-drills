// Sets the screen's branch on <html>, so every accent token follows it: the page ambient on <body>,
// and dialogs and sheets, which render outside the screen's own element. Call it from an $effect;
// the returned function puts back whatever branch was there before.

import type { BRANCH_COLORS } from './tokens';

export type BranchId = keyof typeof BRANCH_COLORS;

export function applyBranch(branch: BranchId | null): () => void {
	const { dataset } = document.documentElement;
	const before = dataset.branch;
	if (branch) dataset.branch = branch;
	else delete dataset.branch;
	return () => {
		if (before === undefined) delete dataset.branch;
		else dataset.branch = before;
	};
}
