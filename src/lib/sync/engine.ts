import type { Repository } from '$lib/storage/repository';
import type { Attempt, Flag } from '$lib/storage/types';
import type { SyncApi } from './api';
import { MAX_FLAGS, MAX_SYNC_BODY_BYTES, SYNC_BATCH, type SyncRequest } from './protocol';

export type SyncOutcome =
	/** `changed` is true when the server brought something new for the UI to show. */
	| { status: 'ok'; changed: boolean }
	| { status: 'signedOut' }
	/** `changed` is true when an earlier round already brought something new. */
	| { status: 'failed'; changed: boolean };

/** More rounds than any real history needs; a guard against a server that never says "done". */
const MAX_ROUNDS = 50;

const encoder = new TextEncoder();
const jsonBytes = (value: unknown): number => encoder.encode(JSON.stringify(value)).length;

/**
 * The request for one round: the longest prefix of `attempts` (up to
 * `SYNC_BATCH`), then of `flags` (up to `MAX_FLAGS`), that keeps the body
 * within `MAX_SYNC_BODY_BYTES`. These are the caps `POST /api/sync` enforces.
 * Attempts and flags share the byte budget; the rest wait for the next round.
 */
export function fitRequest(cursor: number, attempts: readonly Attempt[], flags: readonly Flag[]): SyncRequest {
	const request: SyncRequest = { cursor, attempts: [], flags: [] };
	let size = jsonBytes(request);
	const fill = <T>(batch: T[], items: readonly T[], max: number) => {
		for (const item of items) {
			if (batch.length === max) return;
			const next = size + jsonBytes(item) + (batch.length > 0 ? 1 : 0);
			if (next > MAX_SYNC_BODY_BYTES) return;
			batch.push(item);
			size = next;
		}
	};
	fill(request.attempts, attempts, SYNC_BATCH);
	fill(request.flags, flags, MAX_FLAGS);
	return request;
}

/**
 * Exchanges events with the server until this device has sent everything it
 * has and received everything the server has. Safe to repeat: attempts are
 * stored by id, so a retry after a dropped response duplicates nothing.
 */
export async function runSync(repo: Repository, api: SyncApi): Promise<SyncOutcome> {
	let changed = false;
	for (let round = 0; round < MAX_ROUNDS; round++) {
		const { cursor } = repo.syncState();
		const pendingAttempts = repo.pendingAttempts(SYNC_BATCH);
		const pendingFlags = repo.pendingFlags();
		const request = fitRequest(cursor, pendingAttempts, pendingFlags);
		// Something is waiting but nothing fits: another round would send the same nothing.
		if (request.attempts.length + request.flags.length === 0 && pendingAttempts.length + pendingFlags.length > 0) {
			return { status: 'failed', changed };
		}
		const result = await api.sync(request);
		if (result.kind === 'unauthorized') return { status: 'signedOut' };
		if (result.kind === 'failed') return { status: 'failed', changed };

		const { response } = result;
		// State saved for another account: start over from cursor 0 with everything pending.
		if (repo.adoptAccount(response.account)) continue;
		if (
			repo.applySync({
				sent: request.attempts.map((attempt) => attempt.id),
				sentFlags: request.flags,
				cursor: response.cursor,
				attempts: response.attempts,
				flags: response.flags
			})
		) {
			changed = true;
		}
		if (!response.more && repo.pendingAttempts(1).length === 0 && repo.pendingFlags().length === 0) {
			return { status: 'ok', changed };
		}
	}
	return { status: 'failed', changed };
}
