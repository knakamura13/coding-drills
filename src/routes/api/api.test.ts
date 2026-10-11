import { describe, expect, it } from 'vitest';
import { createMemoryRepo } from '$lib/testing/memoryRepo';
import type { Repo, SessionUser } from '$lib/server/repo';
import { createSyncApi } from '$lib/sync/api';
import { GET as me } from './me/+server';
import { POST as sync } from './sync/+server';

const user: SessionUser = { id: 1, email: 'me@example.com', name: null };
const attempt = {
	id: 'a1',
	at: '2026-10-10T12:00:00.000Z',
	day: '2026-10-10',
	deckId: 'deck',
	questionId: 'q1',
	pickedId: 'a',
	correct: true
};

function post(body: unknown, init: { type?: string } = {}) {
	return new Request('http://localhost/api/sync', {
		method: 'POST',
		headers: { 'content-type': init.type ?? 'application/json' },
		body: typeof body === 'string' ? body : JSON.stringify(body)
	});
}

// The handlers only read `locals` and `request`.
const call = (handler: unknown, locals: { repo: Repo | null; user: SessionUser | null }, request: Request) =>
	(handler as (event: unknown) => Promise<Response>)({ locals, request });

describe('GET /api/me', () => {
	it('answers 503 when there is no database, so the client falls back to local-only', async () => {
		const res = await call(me, { repo: null, user: null }, new Request('http://localhost/api/me'));
		expect(res.status).toBe(503);
		expect(res.headers.get('cache-control')).toBe('no-store');
	});

	it('answers a signed-out request with a null user, not an error', async () => {
		const res = await call(me, { repo: createMemoryRepo(), user: null }, new Request('http://localhost/api/me'));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ user: null });
	});

	it('returns only the email and name of a signed-in user', async () => {
		const res = await call(me, { repo: createMemoryRepo(), user }, new Request('http://localhost/api/me'));
		expect(await res.json()).toEqual({ user: { email: 'me@example.com', name: null } });
	});
});

describe('POST /api/sync', () => {
	const signedIn = () => ({ repo: createMemoryRepo(), user });

	it('refuses without a database (503) and without a session (401)', async () => {
		expect((await call(sync, { repo: null, user }, post({}))).status).toBe(503);
		expect((await call(sync, { repo: createMemoryRepo(), user: null }, post({}))).status).toBe(401);
	});

	it('stores attempts and answers with the cursor and flags', async () => {
		const res = await call(sync, signedIn(), post({ cursor: 0, attempts: [attempt], flags: [] }));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ cursor: 1, attempts: [attempt], flags: [], more: false });
	});

	it.each([
		['a non-JSON body', 'not json'],
		['a missing cursor', { attempts: [], flags: [] }],
		['a negative cursor', { cursor: -1, attempts: [], flags: [] }],
		['a fractional cursor', { cursor: 1.5, attempts: [], flags: [] }],
		['attempts that are not an array', { cursor: 0, attempts: 'x', flags: [] }],
		['a malformed attempt', { cursor: 0, attempts: [{ ...attempt, at: 'yesterday' }], flags: [] }],
		['a malformed flag', { cursor: 0, attempts: [], flags: [{ id: 'f' }] }],
		['too many attempts', { cursor: 0, attempts: Array.from({ length: 1001 }, (_, i) => ({ ...attempt, id: `a${i}` })), flags: [] }]
	])('rejects %s with 400', async (_name, body) => {
		expect((await call(sync, signedIn(), post(body))).status).toBe(400);
	});

	it('rejects a body that is not declared as JSON', async () => {
		const res = await call(sync, signedIn(), post({ cursor: 0, attempts: [], flags: [] }, { type: 'text/plain' }));
		expect(res.status).toBe(400);
	});
});

describe('the browser client', () => {
	const respond = (status: number, body: unknown = {}) =>
		(async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

	it('reads the account state from /api/me', async () => {
		expect(await createSyncApi(respond(503)).me()).toEqual({ kind: 'unavailable' });
		expect(await createSyncApi(respond(404)).me()).toEqual({ kind: 'unavailable' });
		expect(await createSyncApi(respond(200, { user: null })).me()).toEqual({ kind: 'signedOut' });
		expect(await createSyncApi(respond(200, { user: { email: 'a@b.c', name: null } })).me()).toEqual({
			kind: 'signedIn',
			user: { email: 'a@b.c', name: null }
		});
		expect(await createSyncApi(respond(500)).me()).toEqual({ kind: 'failed' });
	});

	it('turns a network error into a result instead of throwing', async () => {
		const offline = (async () => {
			throw new TypeError('offline');
		}) as typeof fetch;
		const api = createSyncApi(offline);
		expect(await api.me()).toEqual({ kind: 'failed' });
		expect(await api.sync({ cursor: 0, attempts: [], flags: [] })).toEqual({ kind: 'failed' });
		await expect(api.signOut()).resolves.toBeUndefined();
	});

	it('maps sync responses', async () => {
		const request = { cursor: 0, attempts: [], flags: [] };
		expect(await createSyncApi(respond(401)).sync(request)).toEqual({ kind: 'unauthorized' });
		expect(await createSyncApi(respond(500)).sync(request)).toEqual({ kind: 'failed' });
		const ok = { cursor: 2, attempts: [], flags: [], more: false };
		expect(await createSyncApi(respond(200, ok)).sync(request)).toEqual({ kind: 'ok', response: ok });
	});
});
