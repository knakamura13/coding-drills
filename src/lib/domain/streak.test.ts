import { describe, expect, it } from 'vitest';
import { streak } from './streak';

describe('streak', () => {
	it('is zero with no answers', () => {
		expect(streak([], '2026-10-10')).toBe(0);
	});

	it('counts consecutive days ending today', () => {
		expect(streak(['2026-10-08', '2026-10-09', '2026-10-10'], '2026-10-10')).toBe(3);
	});

	it('stays alive through today when yesterday was answered', () => {
		expect(streak(['2026-10-08', '2026-10-09'], '2026-10-10')).toBe(2);
	});

	it('is lost after a missed day', () => {
		expect(streak(['2026-10-07', '2026-10-08'], '2026-10-10')).toBe(0);
	});

	it('stops at the first gap and ignores duplicates and order', () => {
		expect(streak(['2026-10-10', '2026-10-10', '2026-10-08', '2026-10-09', '2026-10-05'], '2026-10-10')).toBe(3);
	});

	it('crosses month and year boundaries', () => {
		expect(streak(['2026-12-31', '2027-01-01', '2027-01-02'], '2027-01-02')).toBe(3);
	});
});
