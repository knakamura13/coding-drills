import type { Repository } from '$lib/storage/repository';
import type { SyncApi } from './api';
import { SYNC_BATCH } from './protocol';

export type SyncOutcome =
	/** `changed` is true when the server brought something new for the UI to show. */
	| { status: 'ok'; changed: boolean }
	| { status: 'signedOut' }
	| { status: 'failed' };

/** More rounds than any real history needs; a guard against a server that never says "done". */
const MAX_ROUNDS = 50;

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
		const result = await api.sync({ cursor, attempts: sending, flags: repo.allFlags() });
		if (result.kind === 'unauthorized') return { status: 'signedOut' };
		if (result.kind === 'failed') return { status: 'failed' };

		const { response } = result;
		if (
			repo.applySync({
				sent: sending.map((attempt) => attempt.id),
				cursor: response.cursor,
				attempts: response.attempts,
				flags: response.flags
			})
		) {
			changed = true;
		}
		if (!response.more && repo.pendingAttempts(1).length === 0) return { status: 'ok', changed };
	}
	return { status: 'failed' };
}
