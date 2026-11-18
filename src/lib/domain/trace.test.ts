import { describe, expect, it } from 'vitest';
import type { StepTraceQuestion } from '$lib/content/schema';
import { checkStep, parsePicks, positionsBefore, stepCorrectPick, stepPickIds, stepPickLabel } from './trace';

function traceQuestion(): StepTraceQuestion {
	return {
		format: 'step-trace',
		id: 'trace-sum',
		prompt: 'Trace the scan.',
		code: 'total = nums[l] + nums[r]\nif total < target:\n    l += 1',
		sequence: { kind: 'array', name: 'nums', cells: ['1', '4', '6', '8'] },
		start: [
			{ name: 'l', at: 0 },
			{ name: 'r', at: 3 }
		],
		steps: [
			{
				line: 3,
				ask: 'Where does `l` sit after this pass?',
				pointer: 'l',
				correct: 1,
				explanation: 'The sum is too small, so l moves.',
				misses: [{ index: 3, explanation: 'l never jumps to r.' }],
				elsewhere: 'l moves exactly one cell.'
			},
			{
				line: 1,
				ask: 'What is `total` on the next pass?',
				options: [
					{ id: 'ten', text: '10', explanation: '4 + 8 is 12, not 10.' },
					{ id: 'twelve', text: '12', explanation: '4 + 8 is 12.' }
				],
				correct: 'twelve',
				also: [{ name: 'r', at: 3 }]
			}
		]
	};
}

describe('positionsBefore', () => {
	it('starts from the start cells and applies each revealed step, using the true cell', () => {
		const q = traceQuestion();
		expect(positionsBefore(q, 0)).toEqual({ l: 0, r: 3 });
		expect(positionsBefore(q, 1)).toEqual({ l: 1, r: 3 });
		expect(positionsBefore(q, 2)).toEqual({ l: 1, r: 3 });
	});
});

describe('checkStep', () => {
	it('checks a cell step by cell index with a targeted miss or the fallback', () => {
		const q = traceQuestion();
		expect(checkStep(q, 0, '1')).toEqual({ correct: true, explanation: 'The sum is too small, so l moves.' });
		expect(checkStep(q, 0, '3')).toEqual({ correct: false, explanation: 'l never jumps to r.' });
		expect(checkStep(q, 0, '2')).toEqual({ correct: false, explanation: 'l moves exactly one cell.' });
		expect(checkStep(q, 0, '4')).toBeNull();
		expect(checkStep(q, 0, 'ten')).toBeNull();
	});

	it('checks a choice step by option id and explains the picked option', () => {
		const q = traceQuestion();
		expect(checkStep(q, 1, 'twelve')).toEqual({ correct: true, explanation: '4 + 8 is 12.' });
		expect(checkStep(q, 1, 'ten')).toEqual({ correct: false, explanation: '4 + 8 is 12, not 10.' });
		expect(checkStep(q, 1, '1')).toBeNull();
		expect(checkStep(q, 2, '1')).toBeNull();
	});
});

describe('picks', () => {
	it('lists the ids each step offers and the correct pick', () => {
		const q = traceQuestion();
		expect(stepPickIds(q, 0)).toEqual(['0', '1', '2', '3']);
		expect(stepPickIds(q, 1)).toEqual(['ten', 'twelve']);
		expect(stepCorrectPick(q.steps[0]!)).toBe('1');
		expect(stepCorrectPick(q.steps[1]!)).toBe('twelve');
	});

	it('labels a cell pick with its value and a choice pick with its text', () => {
		const q = traceQuestion();
		expect(stepPickLabel(q, 0, '1')).toBe('index 1, `4`');
		expect(stepPickLabel(q, 1, 'ten')).toBe('10');
	});

	it('reads a whole run of picks and says which steps were right', () => {
		const q = traceQuestion();
		expect(parsePicks(q, '1,twelve')).toEqual({ picks: ['1', 'twelve'], right: [true, true] });
		expect(parsePicks(q, '2,ten')).toEqual({ picks: ['2', 'ten'], right: [false, false] });
		expect(parsePicks(q, '1')).toBeNull();
		expect(parsePicks(q, '1,nope')).toBeNull();
	});
});
