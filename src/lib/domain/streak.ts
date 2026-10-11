import { addDays } from './days';

/**
 * Consecutive days with at least one answer, ending today. A streak stays
 * alive through today until midnight: with nothing answered yet today it still
 * counts up to yesterday, so opening the app in the morning does not show 0.
 */
export function streak(days: Iterable<string>, today: string): number {
	const answered = new Set(days);
	let cursor = answered.has(today) ? today : addDays(today, -1);
	let count = 0;
	while (answered.has(cursor)) {
		count += 1;
		cursor = addDays(cursor, -1);
	}
	return count;
}
