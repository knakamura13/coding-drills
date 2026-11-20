import { describe, expect, it } from 'vitest';
import { glyphShapes, statusLabel, svgPath, type CheckpointState, type NodeState } from './glyphs';
import { BRANCH_COLORS, FALLBACK_BRANCH_COLOR } from './palette';

describe('status glyphs', () => {
	it.each<[NodeState, string]>([
		['open', 'Not started'],
		['practicing', 'Started'],
		['mastered', 'Done'],
		['missed', 'Missed'],
		['failed', 'Needs attention'],
		['locked', 'Locked'],
		['planned', 'Planned']
	])('labels the %s node', (state, label) => {
		expect(statusLabel('skill', state)).toBe(label);
	});

	it.each<[CheckpointState, string]>([
		['available', 'Ready'],
		['passed', 'Passed'],
		['failed', 'Failed'],
		['sealed', 'Locked'],
		['locked', 'Locked']
	])('labels the %s checkpoint', (state, label) => {
		expect(statusLabel('checkpoint', state)).toBe(label);
	});

	it('draws a ready or passed checkpoint in its branch color, and the neutral accent without one', () => {
		const [ready] = glyphShapes('checkpoint', 10, 10, 5, 'available', BRANCH_COLORS.foundations);
		const [passed] = glyphShapes('checkpoint', 10, 10, 5, 'passed', BRANCH_COLORS['data-structures']);
		const [plain] = glyphShapes('checkpoint', 10, 10, 5, 'available');
		expect(ready.kind === 'path' && ready.stroke).toBe(BRANCH_COLORS.foundations);
		expect(passed.kind === 'path' && passed.fill).toBe(BRANCH_COLORS['data-structures']);
		expect(plain.kind === 'path' && plain.stroke).toBe(FALLBACK_BRANCH_COLOR);
	});

	it('renders an open node outline as two arcs, then closes it', () => {
		const [outline] = glyphShapes('skill', 10, 10, 5, 'open', '#446688');
		expect(outline.kind === 'path' && svgPath(outline.segs))
			.toBe('M15 10A5 5 0 0 1 5 10A5 5 0 0 1 15 10Z');
	});

	it('connects a line to an arc and sets the large-arc flag for a sweep over 180 degrees', () => {
		const path = svgPath([
			{ k: 'M', x: 0, y: 0 },
			{ k: 'L', x: 5, y: 3 },
			{ k: 'A', cx: 5, cy: 5, r: 2, a0: 0, a1: Math.PI * 1.5 }
		]);

		expect(path).toBe('M0 0L5 3L7 5A2 2 0 1 1 5 3');
	});
});
