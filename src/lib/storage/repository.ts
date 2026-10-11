import { localDay } from '$lib/domain/days';
import { compareAttempts, isFlag, readAttempt } from './guards';
import { MAX_NOTE_LENGTH, type Attempt, type Flag, type FlagStage } from './types';

/** The slice of the Web Storage API this app uses. */
export interface KeyValueStore {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

export const KEYS = {
	attempts: 'coding-drills:v1:attempts',
	flags: 'coding-drills:v1:flags',
	sync: 'coding-drills:v1:sync'
} as const;

/**
 * Oldest attempts are dropped beyond this, so storage cannot grow without bound.
 * Devices keep the same newest slice of the same history, so they still agree
 * on the schedule after trimming.
 */
export const MAX_ATTEMPTS = 10_000;

/** What a device remembers about its last exchange with the server. */
export interface SyncState {
	/** The newest server position this device has received. */
	cursor: number;
	/** Local attempts the server has not acknowledged yet. */
	pending: string[];
}

export function flagId(deckId: string, questionId: string, stage: FlagStage, optionId?: string): string {
	return [deckId, questionId, stage === 'followUp' ? `followUp:${optionId ?? ''}` : 'question'].join('/');
}

/** `crypto.randomUUID` only exists in secure contexts, and the dev server is served over the LAN. */
function randomId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/** The newer copy wins. A tie keeps the copy already held. */
function newerFlag(held: Flag | undefined, incoming: Flag): Flag {
	return held && held.at >= incoming.at ? held : incoming;
}

/**
 * Attempts, flags, and sync bookkeeping, stored as JSON in the browser. When
 * storage is missing or throws (private windows, blocked site data), data
 * lives in memory for the session so the lesson still works.
 */
export class Repository {
	readonly #store: KeyValueStore | null;
	readonly #now: () => Date;
	readonly #newId: () => string;
	readonly #memory = new Map<string, string>();

	constructor(store: KeyValueStore | null, now: () => Date = () => new Date(), newId: () => string = randomId) {
		this.#store = store;
		this.#now = now;
		this.#newId = newId;
	}

	#readJson(key: string): unknown {
		let raw: string | null = null;
		try {
			raw = this.#store?.getItem(key) ?? this.#memory.get(key) ?? null;
		} catch {
			raw = this.#memory.get(key) ?? null;
		}
		if (raw === null) return null;
		try {
			return JSON.parse(raw);
		} catch {
			return null;
		}
	}

	#write(key: string, value: unknown): void {
		const raw = JSON.stringify(value);
		this.#memory.set(key, raw);
		try {
			this.#store?.setItem(key, raw);
		} catch {
			// Quota or blocked storage: the in-memory copy still serves this session.
		}
	}

	attempts(): Attempt[] {
		const parsed = this.#readJson(KEYS.attempts);
		if (!Array.isArray(parsed)) return [];
		const byId = new Map<string, Attempt>();
		for (const raw of parsed) {
			const attempt = readAttempt(raw);
			if (attempt && !byId.has(attempt.id)) byId.set(attempt.id, attempt);
		}
		return [...byId.values()].sort(compareAttempts);
	}

	#writeAttempts(attempts: Attempt[]): void {
		this.#write(KEYS.attempts, [...attempts].sort(compareAttempts).slice(-MAX_ATTEMPTS));
	}

	recordAttempt(input: Omit<Attempt, 'id' | 'at' | 'day'>): Attempt {
		const now = this.#now();
		const attempt: Attempt = { id: this.#newId(), at: now.toISOString(), day: localDay(now), ...input };
		this.#writeAttempts([...this.attempts(), attempt]);
		// Before the first sync every attempt counts as pending, so there is nothing to add.
		const meta = this.#readSyncMeta();
		if (meta) this.#write(KEYS.sync, { ...meta, pending: [...meta.pending, attempt.id] });
		return attempt;
	}

	/** Every flag including deletions, which sync needs. */
	allFlags(): Flag[] {
		const parsed = this.#readJson(KEYS.flags);
		return Array.isArray(parsed) ? parsed.filter(isFlag) : [];
	}

	flags(): Flag[] {
		return this.allFlags().filter((flag) => !flag.removed);
	}

	/** Creates the flag, or replaces the note on an existing flag for the same target. */
	upsertFlag(input: Omit<Flag, 'id' | 'at' | 'removed'>): Flag {
		const flag: Flag = {
			...input,
			id: flagId(input.deckId, input.questionId, input.stage, input.optionId),
			at: this.#now().toISOString(),
			note: input.note.trim().slice(0, MAX_NOTE_LENGTH)
		};
		this.#write(KEYS.flags, [...this.allFlags().filter((existing) => existing.id !== flag.id), flag]);
		return flag;
	}

	removeFlag(id: string): void {
		const existing = this.allFlags().find((flag) => flag.id === id);
		if (!existing || existing.removed) return;
		const tombstone: Flag = { ...existing, at: this.#now().toISOString(), note: '', removed: true };
		this.#write(KEYS.flags, [...this.allFlags().filter((flag) => flag.id !== id), tombstone]);
	}

	#readSyncMeta(): SyncState | null {
		const meta = this.#readJson(KEYS.sync);
		if (
			typeof meta === 'object' &&
			meta !== null &&
			typeof (meta as SyncState).cursor === 'number' &&
			Array.isArray((meta as SyncState).pending)
		) {
			const { cursor, pending } = meta as SyncState;
			return { cursor, pending: pending.filter((id) => typeof id === 'string') };
		}
		return null;
	}

	/** Never synced means the whole local history is pending: signing in adopts it. */
	syncState(): SyncState {
		return this.#readSyncMeta() ?? { cursor: 0, pending: this.attempts().map((attempt) => attempt.id) };
	}

	pendingAttempts(limit: number): Attempt[] {
		const pending = new Set(this.syncState().pending);
		return this.attempts()
			.filter((attempt) => pending.has(attempt.id))
			.slice(0, limit);
	}

	/**
	 * Folds one server response into local data. `sent` are the attempt ids the
	 * server just acknowledged. Returns whether anything the UI shows changed.
	 */
	applySync(result: { sent: string[]; cursor: number; attempts: Attempt[]; flags: Flag[] }): boolean {
		const before = this.syncState();
		const acknowledged = new Set(result.sent);
		this.#write(KEYS.sync, {
			cursor: Math.max(before.cursor, result.cursor),
			pending: before.pending.filter((id) => !acknowledged.has(id))
		});

		let changed = false;

		const local = this.attempts();
		const known = new Set(local.map((attempt) => attempt.id));
		const incoming = result.attempts.filter((attempt) => !known.has(attempt.id));
		if (incoming.length > 0) {
			this.#writeAttempts([...local, ...incoming]);
			changed = true;
		}

		const flags = new Map(this.allFlags().map((flag) => [flag.id, flag]));
		let flagsChanged = false;
		for (const remote of result.flags) {
			const held = flags.get(remote.id);
			const winner = newerFlag(held, remote);
			if (winner !== held) {
				flags.set(remote.id, winner);
				flagsChanged = true;
			}
		}
		if (flagsChanged) {
			this.#write(KEYS.flags, [...flags.values()]);
			changed = true;
		}
		return changed;
	}
}
