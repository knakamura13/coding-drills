import { describe, expect, it } from 'vitest';
import { replay } from '$lib/domain/srs';
import { createMemoryRepo } from '$lib/testing/memoryRepo';
import { Repository, type KeyValueStore } from '$lib/storage/repository';
import type { SyncApi, SyncResult } from './api';
import { runSync } from './engine';
import { SYNC_BATCH, SYNC_PAGE, type SyncRequest } from './protocol';

function memoryStore(): KeyValueStore {
	const data = new Map<string, string>();
	return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) };
}

/** A device: its own storage and clock, talking to a shared server. */
function device(now: string, counterPrefix: string) {
	let n = 0;
	const clock = { now: new Date(now) };
	const repo = new Repository(memoryStore(), () => clock.now, () => `${counterPrefix}${String(++n).padStart(6, '0')}`);
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
			const response = await repo.sync(user.id, request);
			if (state.dropResponses) return { kind: 'failed' };
			return { kind: 'ok', response };
		},
		async signOut() {}
	};
	return { api, calls, state };
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
		const a = device('2026-10-10T10:00:00.000Z', 'a');
		const total = SYNC_BATCH * 2 + 7;
		for (let i = 0; i < total; i++) a.repo.recordAttempt(answer(`q${i}`));
		expect(await runSync(a.repo, api)).toMatchObject({ status: 'ok' });
		expect(calls.map((call) => call.attempts.length)).toEqual([SYNC_BATCH, SYNC_BATCH, 7]);
		expect(a.repo.syncState().pending).toEqual([]);
	});

	it('downloads a long history across pages', async () => {
		const { api, calls } = await server();
		const a = device('2026-10-10T10:00:00.000Z', 'a');
		const total = SYNC_PAGE + 11;
		for (let i = 0; i < total; i++) a.repo.recordAttempt(answer(`q${i}`));
		await runSync(a.repo, api);

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
