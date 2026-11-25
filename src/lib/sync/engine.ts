import type { Repository } from '$lib/storage/repository';
import type { Flag } from '$lib/storage/types';
import type { SyncApi } from './api';
import { MAX_FLAGS, MAX_SYNC_BODY_BYTES, SYNC_BATCH, type SyncRequest } from './protocol';

export type SyncOutcome =
	/** `changed` is true when the server brought something new for the UI to show. */
	| { status: 'ok'; changed: boolean }
	| { status: 'signedOut' }
	| { status: 'failed' };

/** More rounds than any real history needs; a guard against a server that never says "done". */
const MAX_ROUNDS = 50;

const encoder = new TextEncoder();
const jsonBytes = (value: unknown): number => encoder.encode(JSON.stringify(value)).length;

/**
 * The longest prefix of `flags` that keeps the request within `MAX_FLAGS` and
 * `MAX_SYNC_BODY_BYTES`, the caps `POST /api/sync` enforces. The rest wait for
 * the next round.
 */
export function flagsThatFit(base: Omit<SyncRequest, 'flags'>, flags: readonly Flag[]): Flag[] {
	let size = jsonBytes({ ...base, flags: [] });
	const batch: Flag[] = [];
	for (const flag of flags) {
		if (batch.length === MAX_FLAGS) break;
		const next = size + jsonBytes(flag) + (batch.length > 0 ? 1 : 0);
		if (next > MAX_SYNC_BODY_BYTES) break;
		batch.push(flag);
		size = next;
	}
	return batch;
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
		const sending = repo.pendingAttempts(SYNC_BATCH);
		const flags = flagsThatFit({ cursor, attempts: sending }, repo.pendingFlags());
		const result = await api.sync({ cursor, attempts: sending, flags });
		if (result.kind === 'unauthorized') return { status: 'signedOut' };
		if (result.kind === 'failed') return { status: 'failed' };

		const { response } = result;
		if (
			repo.applySync({
				sent: sending.map((attempt) => attempt.id),
				sentFlags: flags,
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
	return { status: 'failed' };
}
