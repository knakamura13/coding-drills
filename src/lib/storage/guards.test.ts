import { describe, expect, it } from 'vitest';
import { compareAttempts, isAttempt, isFlag, isIsoTime, readAttempt } from './guards';
import type { Attempt } from './types';

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

	it.each([
		['no id', { ...valid, id: undefined }],
		['empty id', { ...valid, id: '' }],
		['huge id', { ...valid, id: 'x'.repeat(201) }],
		['bad time', { ...valid, at: '2026-10-10' }],
		['impossible time', { ...valid, at: '2026-13-45T99:00:00.000Z' }],
		['bad day', { ...valid, day: '10/10/2026' }],
		['non-boolean correct', { ...valid, correct: 'yes' }],
		['bad follow-up', { ...valid, followUp: { pickedId: 3, correct: true } }],
		['an array', [valid]],
		['null', null]
	])('rejects %s', (_name, value) => {
		expect(isAttempt(value)).toBe(false);
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
