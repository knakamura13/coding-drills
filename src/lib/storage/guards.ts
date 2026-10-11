import { DAY_PATTERN, localDay } from '$lib/domain/days';
import { MAX_NOTE_LENGTH, type Attempt, type Flag } from './types';

/**
 * Shape checks shared by the browser store and the sync API. Anything that
 * crosses a trust boundary (localStorage, a request body) goes through these.
 */

const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MAX_ID_LENGTH = 200;

const isString = (value: unknown): value is string => typeof value === 'string';
const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isId = (value: unknown): value is string =>
	isString(value) && value.length > 0 && value.length <= MAX_ID_LENGTH;

/** A `Date.toISOString()` value. Fixed-width, so these compare correctly as strings. */
export const isIsoTime = (value: unknown): value is string =>
	isString(value) && ISO_PATTERN.test(value) && !Number.isNaN(Date.parse(value));

function isFollowUp(value: unknown): boolean {
	return isRecord(value) && isId(value.pickedId) && typeof value.correct === 'boolean';
}

/** An attempt as it travels between devices: every field present and well-formed. */
export function isAttempt(value: unknown): value is Attempt {
	if (!isRecord(value)) return false;
	return (
		isId(value.id) &&
		isIsoTime(value.at) &&
		isString(value.day) &&
		DAY_PATTERN.test(value.day) &&
		isId(value.deckId) &&
		isId(value.questionId) &&
		isId(value.pickedId) &&
		typeof value.correct === 'boolean' &&
		(value.followUp === undefined || isFollowUp(value.followUp))
	);
}

/**
 * Reads an attempt from browser storage. Attempts written before ids and days
 * existed get a deterministic id and the day they happened on this device, so
 * every read of the same record yields the same attempt.
 */
export function readAttempt(value: unknown): Attempt | null {
	if (!isRecord(value) || !isIsoTime(value.at) || !isId(value.deckId) || !isId(value.questionId)) {
		return null;
	}
	const upgraded = {
		...value,
		id: value.id ?? `legacy:${value.at}:${value.deckId}:${value.questionId}`,
		day: value.day ?? localDay(new Date(value.at))
	};
	return isAttempt(upgraded) ? upgraded : null;
}

export function isFlag(value: unknown): value is Flag {
	if (!isRecord(value)) return false;
	return (
		isId(value.id) &&
		isIsoTime(value.at) &&
		isId(value.deckId) &&
		isId(value.questionId) &&
		(value.stage === 'question' || value.stage === 'followUp') &&
		(value.optionId === undefined || isId(value.optionId)) &&
		isString(value.note) &&
		value.note.length <= MAX_NOTE_LENGTH &&
		(value.removed === undefined || value.removed === true)
	);
}

/** Orders attempts by time, then id, so every device replays the same sequence. */
export function compareAttempts(a: Attempt, b: Attempt): number {
	if (a.at !== b.at) return a.at < b.at ? -1 : 1;
	if (a.id !== b.id) return a.id < b.id ? -1 : 1;
	return 0;
}
