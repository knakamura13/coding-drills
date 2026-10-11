import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, localDay } from './days';

describe('days', () => {
	it('formats the local date, not the UTC date', () => {
		expect(localDay(new Date(2026, 9, 10, 23, 30))).toBe('2026-10-10');
		expect(localDay(new Date(2026, 0, 5, 0, 5))).toBe('2026-01-05');
	});

	it('adds days across month, year, and leap-day boundaries', () => {
		expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
		expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
		expect(addDays('2026-10-10', 365)).toBe('2027-10-10');
		expect(addDays('2026-10-10', 0)).toBe('2026-10-10');
	});

	it('counts whole days between two days, even across a DST change', () => {
		expect(daysBetween('2026-10-10', '2026-10-13')).toBe(3);
		expect(daysBetween('2026-10-13', '2026-10-10')).toBe(-3);
		expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
	});
});
