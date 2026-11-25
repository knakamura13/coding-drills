import { describe, expect, it } from 'vitest';
import { replay } from '$lib/domain/srs';
import { createMemoryRepo } from '$lib/testing/memoryRepo';
import { KEYS, Repository, type KeyValueStore } from '$lib/storage/repository';
import type { Attempt, Flag } from '$lib/storage/types';
import type { SyncApi, SyncResult } from './api';
import { runSync } from './engine';
import { MAX_FLAGS, MAX_SYNC_BODY_BYTES, SYNC_BATCH, SYNC_PAGE, type SyncRequest } from './protocol';

const requestBytes = (request: SyncRequest) => new TextEncoder().encode(JSON.stringify(request)).length;

function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
	const data = new Map<string, string>(Object.entries(initial));
	return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) };
}

/** A device: its own storage and clock, talking to a shared server. */
function device(now: string, counterPrefix: string, history: Attempt[] = []) {
	let n = 0;
	const clock = { now: new Date(now) };
	// A long history is written straight into storage: recording it one answer at a time is quadratic.
	const store = memoryStore(history.length > 0 ? { [KEYS.attempts]: JSON.stringify(history) } : {});
	const repo = new Repository(store, () => clock.now, () => `${counterPrefix}${String(++n).padStart(6, '0')}`);
	return { repo, clock };
}

async function server() {
	const repo = createMemoryRepo();
	const user = await repo.upsertUser('sub', 'me@example.com', null);
	const calls: SyncRequest[] = [];
	const state = { down: false, signedIn: true, dropResponses: false };
	const api: SyncApi = {
		async me() {
			return { kind: 'signedIn', user: { email: 'me@example.com', name: null } };
		},
		async sync(request): Promise<SyncResult> {
			calls.push(structuredClone(request));
			if (state.down) return { kind: 'failed' };
			if (!state.signedIn) return { kind: 'unauthorized' };
			// The caps POST /api/sync enforces with a 400.
			if (request.flags.length > MAX_FLAGS || requestBytes(request) > MAX_SYNC_BODY_BYTES) return { kind: 'failed' };
			const response = await repo.sync(user.id, request);
			if (state.dropResponses) return { kind: 'failed' };
			return { kind: 'ok', response };
		},
		async signOut() {}
	};
	return { api, calls, state, repo, userId: user.id };
}

function bulk(count: number, prefix: string): Attempt[] {
	return Array.from({ length: count }, (_, i) => ({
		id: `${prefix}${String(i).padStart(6, '0')}`,
		at: new Date(Date.UTC(2026, 9, 1, 0, 0, 0, i)).toISOString(),
		day: '2026-10-01',
		deckId: 'deck',
		questionId: `q${i}`,
		pickedId: 'a',
		correct: true
	}));
}

const answer = (questionId: string, correct = true) => ({ deckId: 'deck', questionId, pickedId: 'a', correct, ...(correct ? {} : { followUp: { pickedId: 'f', correct: true } }) });

describe('runSync', () => {
	it('uploads local attempts and flags, then has nothing left to send', async () => {
		const { api, calls } = await server();
		const a = device('2026-10-10T10:00:00.000Z', 'a');
		a.repo.recordAttempt(answer('q1'));
		a.repo.upsertFlag({ deckId: 'deck', questionId: 'q1', stage: 'question', note: 'typo' });

		expect(await runSync(a.repo, api)).toEqual({ status: 'ok', changed: false });
		expect(calls[0].attempts).toHaveLength(1);
		expect(calls[0].flags).toHaveLength(1);
		expect(a.repo.syncState().pending).toEqual([]);

		await runSync(a.repo, api);
		expect(calls.at(-1)!.attempts).toEqual([]);
	});

	it('carries work between two devices and leaves both with the same schedule', async () => {
		const { api } = await server();
		const phone = device('2026-10-10T09:00:00.000Z', 'p');
		const laptop = device('2026-10-10T20:00:00.000Z', 'l');

		phone.repo.recordAttempt(answer('q1'));
		phone.repo.recordAttempt(answer('q2', false));
		await runSync(phone.repo, api);

		// The laptop was offline, meanwhile answered q3 and, a day later, q1 again.
		laptop.repo.recordAttempt(answer('q3'));
		laptop.clock.now = new Date('2026-10-11T08:00:00.000Z');
		laptop.repo.recordAttempt(answer('q1'));
		const outcome = await runSync(laptop.repo, api);
		expect(outcome).toEqual({ status: 'ok', changed: true });

		await runSync(phone.repo, api);
		expect(phone.repo.attempts()).toHaveLength(4);
		expect(laptop.repo.attempts()).toEqual(phone.repo.attempts());
		expect([...replay(laptop.repo.attempts()).entries()]).toEqual([...replay(phone.repo.attempts()).entries()]);
	});

	it('does not duplicate attempts when a response is lost and the request is retried', async () => {
		const { api, state } = await server();
		const a = device('2026-10-10T10:00:00.000Z', 'a');
		a.repo.recordAttempt(answer('q1'));

		state.dropResponses = true;
		expect(await runSync(a.repo, api)).toEqual({ status: 'failed' });
		expect(a.repo.syncState().pending).toHaveLength(1);

		state.dropResponses = false;
		await runSync(a.repo, api);
		const b = device('2026-10-10T11:00:00.000Z', 'b');
		await runSync(b.repo, api);
		expect(b.repo.attempts()).toHaveLength(1);
	});

	it('keeps working offline and catches up later', async () => {
		const { api, state } = await server();
		const a = device('2026-10-10T10:00:00.000Z', 'a');
		state.down = true;
		a.repo.recordAttempt(answer('q1'));
		expect(await runSync(a.repo, api)).toEqual({ status: 'failed' });
		a.repo.recordAttempt(answer('q2'));
		state.down = false;
		await runSync(a.repo, api);
		expect(a.repo.syncState().pending).toEqual([]);
	});

	it('reports a lost session without touching local data', async () => {
		const { api, state } = await server();
		const a = device('2026-10-10T10:00:00.000Z', 'a');
		a.repo.recordAttempt(answer('q1'));
		state.signedIn = false;
		expect(await runSync(a.repo, api)).toEqual({ status: 'signedOut' });
		expect(a.repo.attempts()).toHaveLength(1);
		expect(a.repo.syncState().pending).toHaveLength(1);
	});

	it('uploads a long history in batches', async () => {
		const { api, calls } = await server();
		const a = device('2026-10-10T10:00:00.000Z', 'a', bulk(SYNC_BATCH * 2 + 7, 'h'));
		expect(await runSync(a.repo, api)).toMatchObject({ status: 'ok' });
		expect(calls.map((call) => call.attempts.length)).toEqual([SYNC_BATCH, SYNC_BATCH, 7]);
		expect(a.repo.syncState().pending).toEqual([]);
	});

	it('downloads a long history across pages', async () => {
		const { api, calls, repo, userId } = await server();
		const total = SYNC_PAGE + 11;
		await repo.sync(userId, { cursor: 0, attempts: bulk(total, 'h'), flags: [] });

		const b = device('2026-10-11T10:00:00.000Z', 'b');
		calls.length = 0;
		await runSync(b.repo, api);
		expect(b.repo.attempts()).toHaveLength(total);
		expect(calls.length).toBeGreaterThanOrEqual(2);
	});

	it('syncs flag edits and deletions between devices', async () => {
		const { api } = await server();
		const a = device('2026-10-10T10:00:00.000Z', 'a');
		const b = device('2026-10-10T10:00:00.000Z', 'b');
		const flag = a.repo.upsertFlag({ deckId: 'deck', questionId: 'q1', stage: 'question', note: 'first' });
		await runSync(a.repo, api);
		await runSync(b.repo, api);
		expect(b.repo.flags()).toHaveLength(1);

		b.clock.now = new Date('2026-10-10T12:00:00.000Z');
		b.repo.removeFlag(flag.id);
		await runSync(b.repo, api);
		await runSync(a.repo, api);
		expect(a.repo.flags()).toEqual([]);
	});

	it('adopts history recorded before signing in', async () => {
		const { api } = await server();
		const a = device('2026-10-10T10:00:00.000Z', 'a');
		a.repo.recordAttempt(answer('q1'));
		a.repo.recordAttempt(answer('q2'));
		// Nothing has synced yet, so everything counts as pending.
		expect(a.repo.syncState().cursor).toBe(0);
		await runSync(a.repo, api);
		const b = device('2026-10-11T10:00:00.000Z', 'b');
		await runSync(b.repo, api);
		expect(b.repo.attempts().map((attempt) => attempt.questionId)).toEqual(['q1', 'q2']);
	});
});

describe('records stored before #158', () => {
	it('syncs to completion instead of failing on every run, cleaning a bad note and dropping an unusable attempt', async () => {
		const { api, repo: server_, userId } = await server();
		const good = bulk(1, 'g')[0];
		const store = memoryStore({
			[KEYS.attempts]: JSON.stringify([good, { ...bulk(1, 'bad')[0], questionId: 'q\u0000' }]),
			[KEYS.flags]: JSON.stringify([
				{ id: 'deck/q0/question', at: '2026-10-01T00:00:00.000Z', deckId: 'deck', questionId: 'q0', stage: 'question', note: 'see\u0000 this\ud83d' }
			])
		});
		const repo = new Repository(store, () => new Date('2026-10-02T00:00:00.000Z'));

		expect(await runSync(repo, api)).toEqual({ status: 'ok', changed: false });
		expect(repo.pendingAttempts(10)).toEqual([]);
		const held = await server_.sync(userId, { cursor: 0, attempts: [], flags: [] });
		expect(held.attempts).toEqual([good]);
		expect(held.flags.map((flag) => flag.note)).toEqual(['see this\uFFFD']);
	});
});

function manyFlags(count: number, note = 'n'): Flag[] {
	return Array.from({ length: count }, (_, i) => ({
		id: `deck/q${i}/question`,
		at: new Date(Date.UTC(2026, 9, 1, 0, 0, 0, i)).toISOString(),
		deckId: 'deck',
		questionId: `q${i}`,
		stage: 'question',
		note
	}));
}

/** A device whose storage already holds these flags. */
function deviceWithFlags(flags: Flag[]) {
	return new Repository(memoryStore({ [KEYS.flags]: JSON.stringify(flags) }), () => new Date('2026-10-02T00:00:00.000Z'));
}

describe('flags beyond one request', () => {
	it('syncs more than MAX_FLAGS flags to another device, never over the flag cap', async () => {
		const { api, calls } = await server();
		const flags = manyFlags(MAX_FLAGS + 500);
		expect(await runSync(deviceWithFlags(flags), api)).toMatchObject({ status: 'ok' });
		expect(calls.every((call) => call.flags.length <= MAX_FLAGS)).toBe(true);

		const other = device('2026-10-03T00:00:00.000Z', 'b');
		expect(await runSync(other.repo, api)).toEqual({ status: 'ok', changed: true });
		expect(other.repo.allFlags()).toHaveLength(flags.length);
	});

	it('keeps every request under the body cap when notes are long', async () => {
		const { api, calls } = await server();
		const flags = manyFlags(600, 'é'.repeat(1000));
		expect(await runSync(deviceWithFlags(flags), api)).toMatchObject({ status: 'ok' });
		expect(calls.length).toBeGreaterThan(1);
		expect(calls.every((call) => requestBytes(call) <= MAX_SYNC_BODY_BYTES)).toBe(true);

		const other = device('2026-10-03T00:00:00.000Z', 'b');
		await runSync(other.repo, api);
		expect(other.repo.allFlags()).toHaveLength(flags.length);
	});

	it('sends a flag until the server holds it, then only edits and deletions', async () => {
		const { api, calls } = await server();
		const one = device('2026-10-01T00:00:00.000Z', 'a');
		const flag = one.repo.upsertFlag({ deckId: 'deck', questionId: 'q1', stage: 'question', note: 'unclear' });
		await runSync(one.repo, api);
		await runSync(one.repo, api);
		expect(calls.map((call) => call.flags.length)).toEqual([1, 0]);

		one.clock.now = new Date('2026-10-01T01:00:00.000Z');
		one.repo.removeFlag(flag.id);
		await runSync(one.repo, api);
		expect(calls.at(-1)!.flags).toEqual([{ ...flag, at: '2026-10-01T01:00:00.000Z', note: '', removed: true }]);

		const other = device('2026-10-02T00:00:00.000Z', 'b');
		await runSync(other.repo, api);
		expect(other.repo.allFlags()).toMatchObject([{ id: flag.id, removed: true }]);
		expect(other.repo.flags()).toEqual([]);
	});

	it('sends a flag again when it was edited while its request was in flight', async () => {
		const backend = await server();
		const one = device('2026-10-01T00:00:00.000Z', 'a');
		one.repo.upsertFlag({ deckId: 'deck', questionId: 'q1', stage: 'question', note: 'first' });
		let edited = false;
		const api: SyncApi = {
			...backend.api,
			async sync(request) {
				const result = await backend.api.sync(request);
				if (!edited) {
					edited = true;
					one.clock.now = new Date('2026-10-01T00:05:00.000Z');
					one.repo.upsertFlag({ deckId: 'deck', questionId: 'q1', stage: 'question', note: 'second' });
				}
				return result;
			}
		};
		expect(await runSync(one.repo, api)).toMatchObject({ status: 'ok' });
		const held = await backend.repo.sync(backend.userId, { cursor: 0, attempts: [], flags: [] });
		expect(held.flags.map((flag) => flag.note)).toEqual(['second']);
	});

	it('sends every flag once from a device whose saved sync state predates pending flags', async () => {
		const { api, calls } = await server();
		const flags = manyFlags(3);
		const repo = new Repository(
			memoryStore({ [KEYS.flags]: JSON.stringify(flags), [KEYS.sync]: JSON.stringify({ cursor: 0, pending: [] }) })
		);
		await runSync(repo, api);
		await runSync(repo, api);
		expect(calls.map((call) => call.flags.length)).toEqual([3, 0]);
	});
});
