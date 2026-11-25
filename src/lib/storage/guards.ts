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

/**
 * Text Postgres cannot keep in a jsonb string: a null character, or half of a
 * surrogate pair. Either one fails the whole sync transaction (#158).
 */
const UNSTORABLE = /[\u0000\p{Cs}]/u;
/** Any control character (C0, DEL, C1) or half of a surrogate pair. Deck ids are kebab-case, so a real id has none. */
const NOT_ID_TEXT = /[\p{Cc}\p{Cs}]/u;
/** What a note may not hold: control characters other than tab, newline and carriage return, or half of a surrogate pair. */
const NOT_NOTE_TEXT = /(?![\t\n\r])\p{Cc}|\p{Cs}/u;

/** Whether a string can be stored by the server. The fake repo uses this to refuse what Postgres refuses. */
export const isStorableText = (value: string): boolean => !UNSTORABLE.test(value);

const isId = (value: unknown): value is string =>
	isString(value) && value.length > 0 && value.length <= MAX_ID_LENGTH && !NOT_ID_TEXT.test(value);

const isNote = (value: unknown): value is string =>
	isString(value) && value.length <= MAX_NOTE_LENGTH && !NOT_NOTE_TEXT.test(value);

/**
 * Makes a note safe to store and sync: drops the control characters a note may
 * not hold, replaces half of a surrogate pair with U+FFFD, trims, and caps the
 * length without cutting a pair in two. `isNote` accepts every result.
 */
export function cleanNote(raw: string): string {
	let note = raw
		.replace(/(?![\t\n\r])\p{Cc}/gu, '')
		.replace(/\p{Cs}/gu, '\uFFFD')
		.trim();
	if (note.length > MAX_NOTE_LENGTH) {
		note = note.slice(0, MAX_NOTE_LENGTH);
		if (/[\uD800-\uDBFF]$/.test(note)) note = note.slice(0, -1);
	}
	return note;
}

/** A `Date.toISOString()` value. Fixed-width, so these compare correctly as strings. */
export const isIsoTime = (value: unknown): value is string =>
	isString(value) && ISO_PATTERN.test(value) && !Number.isNaN(Date.parse(value));

function isFollowUp(value: unknown): value is { pickedId: string; correct: boolean } {
	return isRecord(value) && isId(value.pickedId) && typeof value.correct === 'boolean';
}

/**
 * An attempt as it travels between devices: every field present and well-formed.
 * `pickedId` is an option id or a tap-cell index (`"0"`, `"1"`, …). A wrong tap
 * omits `followUp`; the cell's explanation lives in the deck, not the attempt.
 */
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
		(value.followUp === undefined || isFollowUp(value.followUp)) &&
		(value.reviewOf === undefined ||
			(isRecord(value.reviewOf) && isId(value.reviewOf.deckId) && isId(value.reviewOf.questionId)))
	);
}

/**
 * A well-formed attempt rebuilt from its known fields only, so unknown keys never
 * reach storage or another device. Null when `isAttempt` rejects it.
 */
export function parseAttempt(value: unknown): Attempt | null {
	if (!isAttempt(value)) return null;
	const { id, at, day, deckId, questionId, pickedId, correct, followUp, reviewOf } = value;
	return {
		id,
		at,
		day,
		deckId,
		questionId,
		pickedId,
		correct,
		...(followUp && { followUp: { pickedId: followUp.pickedId, correct: followUp.correct } }),
		...(reviewOf && { reviewOf: { deckId: reviewOf.deckId, questionId: reviewOf.questionId } })
	};
}

/**
 * Reads an attempt from browser storage. Attempts written before ids and days
 * existed get a deterministic id and the day they happened on this device, so
 * every read of the same record yields the same attempt.
 *
 * An attempt with a control character in an id is dropped, not repaired: deck
 * ids are kebab-case, so it names no question and counts toward no schedule,
 * and stripping the character could make it name a real one.
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
	return parseAttempt(upgraded);
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
		isNote(value.note) &&
		(value.removed === undefined || value.removed === true)
	);
}

/** A well-formed flag rebuilt from its known fields only. Null when `isFlag` rejects it. */
export function parseFlag(value: unknown): Flag | null {
	if (!isFlag(value)) return null;
	const { id, at, deckId, questionId, stage, optionId, note, removed } = value;
	return {
		id,
		at,
		deckId,
		questionId,
		stage,
		...(optionId !== undefined && { optionId }),
		note,
		...(removed && { removed })
	};
}

/**
 * Reads a flag from browser storage. A note saved before notes were cleaned
 * (#158) is cleaned on read instead of losing the flag, so it can still sync.
 * Every read of the same record yields the same flag.
 */
export function readFlag(value: unknown): Flag | null {
	if (!isRecord(value) || !isString(value.note)) return null;
	return parseFlag({ ...value, note: cleanNote(value.note) });
}

/** Orders attempts by time, then id, so every device replays the same sequence. */
export function compareAttempts(a: Attempt, b: Attempt): number {
	if (a.at !== b.at) return a.at < b.at ? -1 : 1;
	if (a.id !== b.id) return a.id < b.id ? -1 : 1;
	return 0;
}
