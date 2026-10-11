import { MAX_NOTE_LENGTH, type Attempt, type Flag, type FlagStage } from './types';

/** The slice of the Web Storage API this app uses. */
export interface KeyValueStore {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

export const KEYS = {
	attempts: 'coding-drills:v1:attempts',
	flags: 'coding-drills:v1:flags'
} as const;

/** Oldest attempts are dropped beyond this, so storage cannot grow without bound. */
export const MAX_ATTEMPTS = 2000;

const isString = (value: unknown): value is string => typeof value === 'string';
const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

function isAttempt(value: unknown): value is Attempt {
	if (!isRecord(value)) return false;
	if (![value.at, value.deckId, value.questionId, value.pickedId].every(isString)) return false;
	if (typeof value.correct !== 'boolean') return false;
	if (value.followUp === undefined) return true;
	return (
		isRecord(value.followUp) &&
		isString(value.followUp.pickedId) &&
		typeof value.followUp.correct === 'boolean'
	);
}

function isFlag(value: unknown): value is Flag {
	if (!isRecord(value)) return false;
	if (![value.id, value.at, value.deckId, value.questionId, value.note].every(isString)) return false;
	if (value.stage !== 'question' && value.stage !== 'followUp') return false;
	return value.optionId === undefined || isString(value.optionId);
}

export function flagId(deckId: string, questionId: string, stage: FlagStage, optionId?: string): string {
	return [deckId, questionId, stage === 'followUp' ? `followUp:${optionId ?? ''}` : 'question'].join('/');
}

/**
 * Attempts and flags, stored as JSON in the browser. When storage is missing or
 * throws (private windows, blocked site data), data lives in memory for the
 * session so the lesson still works.
 */
export class Repository {
	readonly #store: KeyValueStore | null;
	readonly #now: () => Date;
	readonly #memory = new Map<string, string>();

	constructor(store: KeyValueStore | null, now: () => Date = () => new Date()) {
		this.#store = store;
		this.#now = now;
	}

	#read<T>(key: string, guard: (value: unknown) => value is T): T[] {
		let raw: string | null = null;
		try {
			raw = this.#store?.getItem(key) ?? this.#memory.get(key) ?? null;
		} catch {
			raw = this.#memory.get(key) ?? null;
		}
		if (raw === null) return [];
		try {
			const parsed: unknown = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed.filter(guard) : [];
		} catch {
			return [];
		}
	}

	#write(key: string, value: unknown[]): void {
		const raw = JSON.stringify(value);
		this.#memory.set(key, raw);
		try {
			this.#store?.setItem(key, raw);
		} catch {
			// Quota or blocked storage: the in-memory copy still serves this session.
		}
	}

	attempts(): Attempt[] {
		return this.#read(KEYS.attempts, isAttempt);
	}

	recordAttempt(input: Omit<Attempt, 'at'>): void {
		const attempts = [...this.attempts(), { at: this.#now().toISOString(), ...input }];
		this.#write(KEYS.attempts, attempts.slice(-MAX_ATTEMPTS));
	}

	flags(): Flag[] {
		return this.#read(KEYS.flags, isFlag);
	}

	/** Creates the flag, or replaces the note on an existing flag for the same target. */
	upsertFlag(input: Omit<Flag, 'id' | 'at'>): Flag {
		const flag: Flag = {
			...input,
			id: flagId(input.deckId, input.questionId, input.stage, input.optionId),
			at: this.#now().toISOString(),
			note: input.note.trim().slice(0, MAX_NOTE_LENGTH)
		};
		this.#write(KEYS.flags, [...this.flags().filter((existing) => existing.id !== flag.id), flag]);
		return flag;
	}

	removeFlag(id: string): void {
		this.#write(
			KEYS.flags,
			this.flags().filter((flag) => flag.id !== id)
		);
	}
}
