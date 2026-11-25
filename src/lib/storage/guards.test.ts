import { describe, expect, it } from 'vitest';
import {
	cleanNote,
	compareAttempts,
	isAttempt,
	isFlag,
	isIsoTime,
	isStorableText,
	parseAttempt,
	parseFlag,
	readAttempt,
	readFlag
} from './guards';
import { MAX_NOTE_LENGTH, type Attempt } from './types';

const valid: Attempt = {
	id: 'a1',
	at: '2026-10-10T12:00:00.000Z',
	day: '2026-10-10',
	deckId: 'deck',
	questionId: 'q1',
	pickedId: 'a',
	correct: false,
	followUp: { pickedId: 'x', correct: true }
};

describe('isAttempt', () => {
	it('accepts a complete attempt, with or without a follow-up', () => {
		expect(isAttempt(valid)).toBe(true);
		expect(isAttempt({ ...valid, followUp: undefined })).toBe(true);
	});

	it('accepts an older attempt that still carries the retired examRulesVersion key, and reads it without the key', () => {
		expect(isAttempt({ ...valid, examRulesVersion: 16 })).toBe(true);
		expect(readAttempt({ ...valid, examRulesVersion: 6 })).toEqual(valid);
	});

	it('accepts a tap-cell attempt whose picked id is a cell index and that has no follow-up', () => {
		expect(isAttempt({ ...valid, pickedId: '0', correct: true, followUp: undefined })).toBe(true);
		expect(isAttempt({ ...valid, pickedId: '12', correct: false, followUp: undefined })).toBe(true);
	});

	it.each([
		['no id', { ...valid, id: undefined }],
		['empty id', { ...valid, id: '' }],
		['huge id', { ...valid, id: 'x'.repeat(201) }],
		['bad time', { ...valid, at: '2026-10-10' }],
		['impossible time', { ...valid, at: '2026-13-45T99:00:00.000Z' }],
		['bad day', { ...valid, day: '10/10/2026' }],
		['non-boolean correct', { ...valid, correct: 'yes' }],
		['bad follow-up', { ...valid, followUp: { pickedId: 3, correct: true } }],
		['a null character in the id', { ...valid, id: 'a\u0000' }],
		['a control character in the deck id', { ...valid, deckId: 'deck\u0007' }],
		['DEL in the question id', { ...valid, questionId: 'q\u007f' }],
		['a C1 control in the picked id', { ...valid, pickedId: '\u0085a' }],
		['a newline in the follow-up pick', { ...valid, followUp: { pickedId: 'x\n', correct: true } }],
		['a lone surrogate in the review target', { ...valid, reviewOf: { deckId: 'deck', questionId: '\ud83d' } }],
		['an array', [valid]],
		['null', null]
	])('rejects %s', (_name, value) => {
		expect(isAttempt(value)).toBe(false);
	});
});

describe('parseAttempt', () => {
	it('rebuilds an attempt from its known fields only, nested ones included', () => {
		const withReview = { ...valid, reviewOf: { deckId: 'deck', questionId: 'q0' } };
		const noisy = {
			...withReview,
			junk: 'x',
			followUp: { ...valid.followUp, extra: 1 },
			reviewOf: { ...withReview.reviewOf, extra: 2 }
		};
		expect(parseAttempt(noisy)).toEqual(withReview);
		expect(parseAttempt({ ...valid, followUp: undefined })).toEqual({ ...valid, followUp: undefined });
		expect(Object.keys(parseAttempt({ ...valid, followUp: undefined })!)).not.toContain('followUp');
		expect(parseAttempt({ ...valid, id: '' })).toBeNull();
	});
});

describe('readAttempt', () => {
	it('upgrades an attempt from before ids existed', () => {
		const { id: _id, day: _day, ...legacy } = valid;
		const read = readAttempt(legacy)!;
		expect(read.id).toBe('legacy:2026-10-10T12:00:00.000Z:deck:q1');
		expect(read.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(readAttempt(legacy)).toEqual(read);
	});

	it('keeps an existing id and day', () => {
		expect(readAttempt(valid)).toEqual(valid);
	});

	it('rejects what cannot be repaired', () => {
		expect(readAttempt({ at: 'x' })).toBeNull();
		expect(readAttempt('text')).toBeNull();
	});

	it('drops a stored attempt with a control character in an id instead of guessing the real id', () => {
		expect(readAttempt({ ...valid, questionId: 'q1\u0000' })).toBeNull();
	});
});

describe('isFlag', () => {
	const flag = { id: 'f', at: '2026-10-10T12:00:00.000Z', deckId: 'd', questionId: 'q', stage: 'question', note: 'n' };

	it('accepts flags and tombstones', () => {
		expect(isFlag(flag)).toBe(true);
		expect(isFlag({ ...flag, removed: true })).toBe(true);
		expect(isFlag({ ...flag, stage: 'followUp', optionId: 'a' })).toBe(true);
	});

	it('rejects malformed flags and oversized notes', () => {
		expect(isFlag({ ...flag, removed: false })).toBe(false);
		expect(isFlag({ ...flag, stage: 'later' })).toBe(false);
		expect(isFlag({ ...flag, note: 'x'.repeat(1001) })).toBe(false);
		expect(isFlag({ ...flag, at: 'now' })).toBe(false);
	});

	it('accepts a note with tabs, line breaks, emoji and accents', () => {
		expect(isFlag({ ...flag, note: 'line one\r\nline\ttwo 😀 é' })).toBe(true);
	});

	it.each([
		['a null character in the note', { note: 'n\u0000' }],
		['another control character in the note', { note: 'n\u0001' }],
		['a lone surrogate in the note', { note: 'n\ud83d' }],
		['a control character in the option id', { stage: 'followUp', optionId: 'a\u0000' }],
		['a control character in the id', { id: 'f\u001b' }]
	])('rejects %s', (_name, over) => {
		expect(isFlag({ ...flag, ...over })).toBe(false);
	});

	it('rebuilds a flag from its known fields only', () => {
		expect(parseFlag({ ...flag, junk: true })).toEqual(flag);
		expect(parseFlag({ ...flag, removed: true, note: '' })).toEqual({ ...flag, removed: true, note: '' });
		expect(parseFlag({ ...flag, note: 'n\u0000' })).toBeNull();
	});

	it('cleans the note of a stored flag on read instead of dropping the flag', () => {
		expect(readFlag({ ...flag, note: 'bad\u0000 note\ud83d', junk: 1 })).toEqual({ ...flag, note: 'bad note\uFFFD' });
		expect(readFlag({ ...flag, note: 3 })).toBeNull();
		expect(readFlag('text')).toBeNull();
	});
});

describe('cleanNote', () => {
	it('drops control characters except tab and line breaks, and replaces half of a surrogate pair', () => {
		expect(cleanNote('  a\u0000b\u0007c\td\ne\u007f\ude00f 😀  ')).toBe('abc\td\ne\uFFFDf 😀');
	});

	it('caps the length without cutting a surrogate pair in two', () => {
		const note = cleanNote(`${'x'.repeat(MAX_NOTE_LENGTH - 1)}😀`);
		expect(note).toBe('x'.repeat(MAX_NOTE_LENGTH - 1));
		expect(isFlag({ id: 'f', at: '2026-10-10T12:00:00.000Z', deckId: 'd', questionId: 'q', stage: 'question', note })).toBe(true);
	});

	it('agrees with the flag check on every UTF-16 code unit: it keeps exactly what the check accepts', () => {
		const flag = { id: 'f', at: '2026-10-10T12:00:00.000Z', deckId: 'd', questionId: 'q', stage: 'question' };
		for (let unit = 0; unit <= 0xffff; unit++) {
			const note = `a${String.fromCharCode(unit)}b`;
			expect(cleanNote(note) === note, `U+${unit.toString(16)}`).toBe(isFlag({ ...flag, note }));
		}
	});

	it('always yields text the server can store', () => {
		for (const raw of ['\u0000', '\ud800\udc00\ud800', '😀'.repeat(600), 'a\u0000'.repeat(700)]) {
			const note = cleanNote(raw);
			expect(isStorableText(note)).toBe(true);
			expect(isFlag({ id: 'f', at: '2026-10-10T12:00:00.000Z', deckId: 'd', questionId: 'q', stage: 'question', note })).toBe(true);
		}
	});
});

describe('compareAttempts and isIsoTime', () => {
	it('orders by time, then by id', () => {
		const early = { ...valid, id: 'b', at: '2026-10-10T09:00:00.000Z' };
		const lateA = { ...valid, id: 'a' };
		const lateB = { ...valid, id: 'b' };
		expect([lateB, lateA, early].sort(compareAttempts).map((a) => `${a.at.slice(11, 13)}${a.id}`)).toEqual(['09b', '12a', '12b']);
		expect(compareAttempts(lateA, lateA)).toBe(0);
	});

	it('accepts only the fixed-width ISO form', () => {
		expect(isIsoTime('2026-10-10T12:00:00.000Z')).toBe(true);
		expect(isIsoTime('2026-10-10T12:00:00Z')).toBe(false);
		expect(isIsoTime(5)).toBe(false);
	});
});
