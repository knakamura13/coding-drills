/**
 * Calendar days as `YYYY-MM-DD` strings. Day arithmetic goes through UTC so it
 * never depends on the device's time zone or daylight saving, which keeps the
 * schedule identical on every device that replays the same attempts.
 */

export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const DAY_MS = 86_400_000;

/** The date as seen on this device's wall clock. */
export function localDay(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${date.getFullYear()}-${month}-${day}`;
}

function toUtcMs(day: string): number {
	const [year, month, date] = day.split('-').map(Number);
	return Date.UTC(year, month - 1, date);
}

export function addDays(day: string, days: number): string {
	return new Date(toUtcMs(day) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
	return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}
