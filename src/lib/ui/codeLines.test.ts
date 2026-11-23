import { describe, expect, it } from 'vitest';
import { codeLines } from './codeLines';

const keywords = (code: string) =>
	codeLines(code).map((line) => line.filter((run) => run.keyword).map((run) => run.text));

describe('codeLines', () => {
	it('marks Python keywords and keeps every character in order', () => {
		const code = 'def search(a, t):\n    while lo <= hi:\n        if a[mid] == t:\n            return mid';
		expect(keywords(code)).toEqual([['def'], ['while'], ['if'], ['return']]);
		expect(codeLines(code).map((line) => line.map((run) => run.text).join(''))).toEqual(code.split('\n'));
	});

	it('does not mark keywords inside names, strings or comments', () => {
		expect(keywords('index = 0  # if this, return')).toEqual([[]]);
		expect(keywords("label = 'for in while'")).toEqual([[]]);
		expect(keywords('format_in = ifs + returned')).toEqual([[]]);
	});

	it('keeps blank lines and drops only trailing newlines', () => {
		expect(codeLines('a = 1\n\nb = 2\n')).toHaveLength(3);
		expect(codeLines('a = 1\n\nb = 2\n')[1]).toEqual([]);
	});

	it('marks for, in and True on one line', () => {
		expect(keywords('for j in range(3): ok = True')).toEqual([['for', 'in', 'True']]);
	});
});
