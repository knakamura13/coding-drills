import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { applyBranch } from './branch';

let dataset: Record<string, string>;

beforeEach(() => {
	dataset = {};
	vi.stubGlobal('document', { documentElement: { dataset } });
});

afterEach(() => vi.unstubAllGlobals());

describe('applyBranch', () => {
	it('sets the branch on <html> and removes it again', () => {
		const undo = applyBranch('sequences-and-search');
		expect(dataset.branch).toBe('sequences-and-search');
		undo();
		expect(dataset.branch).toBeUndefined();
	});

	it('puts back the branch that was there before', () => {
		dataset.branch = 'foundations';
		const undo = applyBranch('trees-and-graphs');
		expect(dataset.branch).toBe('trees-and-graphs');
		undo();
		expect(dataset.branch).toBe('foundations');
	});

	it('clears the branch for a screen with none, then restores it', () => {
		dataset.branch = 'foundations';
		const undo = applyBranch(null);
		expect(dataset.branch).toBeUndefined();
		undo();
		expect(dataset.branch).toBe('foundations');
	});

	// The old app.css also sets --accent on :root. A branch on <html> must win whichever loads last.
	it('gives branch rules more weight than a bare :root', () => {
		const css = readFileSync('src/lib/ui/tokens.css', 'utf8');
		expect(css).toMatch(/:root\[data-branch='sequences-and-search'\],\n\[data-branch='sequences-and-search'\] \{/);
	});
});
