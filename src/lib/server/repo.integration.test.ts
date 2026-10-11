import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMemoryRepo } from '$lib/testing/memoryRepo';
import { SYNC_PAGE } from '$lib/sync/protocol';
import type { Attempt, Flag } from '$lib/storage/types';
import { migrate, type Sql } from './db';
import { createRepo, type Repo } from './repo';

/**
 * The same contract runs against the in-memory fake and against a real
 * Postgres engine (PGlite behind a socket, so it needs no Docker and no
 * service container). Set TEST_DATABASE_URL to run the SQL half against a
 * server of your choice instead.
 */

const attempt = (id: string, over: Partial<Attempt> = {}): Attempt => ({
	id,
	at: '2026-10-10T12:00:00.000Z',
	day: '2026-10-10',
	deckId: 'deck',
	questionId: 'q1',
	pickedId: 'a',
	correct: true,
	...over
});

const flag = (at: string, note: string, over: Partial<Flag> = {}): Flag => ({
	id: 'deck/q1/question',
	at,
	deckId: 'deck',
	questionId: 'q1',
	stage: 'question',
	note,
	...over
});

function contract(name: string, make: () => Promise<Repo>) {
	describe(name, () => {
		let repo: Repo;
		let userId: number;
		let otherId: number;

		beforeAll(async () => {
			repo = await make();
			userId = (await repo.upsertUser(`sub-${name}-1`, 'me@example.com', 'Me')).id;
			otherId = (await repo.upsertUser(`sub-${name}-2`, 'other@example.com', null)).id;
		});

		it('finds or creates a user by Google id and refreshes the email', async () => {
			const again = await repo.upsertUser(`sub-${name}-1`, 'renamed@example.com', 'Me');
			expect(again).toEqual({ id: userId, email: 'renamed@example.com', name: 'Me' });
		});

		it('resolves a live session, extends it, and forgets it after deletion or expiry', async () => {
			const now = new Date('2026-10-10T00:00:00Z');
			await repo.createSession(`tok-${name}`, userId, new Date('2026-10-11T00:00:00Z'));
			const live = await repo.userForSession(`tok-${name}`, now);
			expect(live?.user.id).toBe(userId);

			await repo.extendSession(`tok-${name}`, new Date('2026-12-01T00:00:00Z'));
			expect((await repo.userForSession(`tok-${name}`, now))?.expiresAt.toISOString()).toBe(
				'2026-12-01T00:00:00.000Z'
			);
			expect(await repo.userForSession(`tok-${name}`, new Date('2026-12-02T00:00:00Z'))).toBeNull();

			await repo.deleteSession(`tok-${name}`);
			expect(await repo.userForSession(`tok-${name}`, now)).toBeNull();
			expect(await repo.userForSession('never-created', now)).toBeNull();
		});

		it('stores attempts once, however often they are sent, and hands them back by cursor', async () => {
			const first = await repo.sync(userId, { cursor: 0, attempts: [attempt('a1'), attempt('a2')], flags: [] });
			expect(first.attempts.map((a) => a.id)).toEqual(['a1', 'a2']);
			expect(first.more).toBe(false);

			const repeat = await repo.sync(userId, { cursor: first.cursor, attempts: [attempt('a1'), attempt('a3')], flags: [] });
			expect(repeat.attempts.map((a) => a.id)).toEqual(['a3']);

			const fresh = await repo.sync(userId, { cursor: 0, attempts: [], flags: [] });
			expect(fresh.attempts.map((a) => a.id)).toEqual(['a1', 'a2', 'a3']);
			expect(fresh.cursor).toBeGreaterThan(first.cursor);

			const caughtUp = await repo.sync(userId, { cursor: fresh.cursor, attempts: [], flags: [] });
			expect(caughtUp.attempts).toEqual([]);
			expect(caughtUp.cursor).toBe(fresh.cursor);
		});

		it('round-trips every attempt field', async () => {
			const full = attempt('full', { correct: false, followUp: { pickedId: 'x', correct: true } });
			await repo.sync(userId, { cursor: 0, attempts: [full], flags: [] });
			const back = await repo.sync(userId, { cursor: 0, attempts: [], flags: [] });
			expect(back.attempts.find((a) => a.id === 'full')).toEqual(full);
		});

		it('keeps each user data separate', async () => {
			await repo.sync(otherId, { cursor: 0, attempts: [attempt('o1')], flags: [flag('2026-10-10T12:00:00.000Z', 'theirs', { id: 'other/flag' })] });
			const mine = await repo.sync(userId, { cursor: 0, attempts: [], flags: [] });
			expect(mine.attempts.some((a) => a.id === 'o1')).toBe(false);
			expect(mine.flags.some((f) => f.id === 'other/flag')).toBe(false);
			const theirs = await repo.sync(otherId, { cursor: 0, attempts: [], flags: [] });
			expect(theirs.attempts.map((a) => a.id)).toEqual(['o1']);
		});

		it('lets the same attempt id exist for two users', async () => {
			await repo.sync(userId, { cursor: 0, attempts: [attempt('shared')], flags: [] });
			await repo.sync(otherId, { cursor: 0, attempts: [attempt('shared')], flags: [] });
			const theirs = await repo.sync(otherId, { cursor: 0, attempts: [], flags: [] });
			expect(theirs.attempts.filter((a) => a.id === 'shared')).toHaveLength(1);
		});

		it('keeps the newest copy of a flag, including a deletion', async () => {
			const older = flag('2026-10-10T10:00:00.000Z', 'old');
			const newer = flag('2026-10-10T11:00:00.000Z', 'new');
			await repo.sync(userId, { cursor: 0, attempts: [], flags: [newer] });
			let result = await repo.sync(userId, { cursor: 0, attempts: [], flags: [older] });
			expect(result.flags.find((f) => f.id === newer.id)?.note).toBe('new');

			const tombstone = flag('2026-10-10T12:30:00.000Z', '', { removed: true });
			result = await repo.sync(userId, { cursor: 0, attempts: [], flags: [tombstone] });
			expect(result.flags.find((f) => f.id === newer.id)).toMatchObject({ removed: true });

			// Duplicate ids within one request must not break the write.
			result = await repo.sync(userId, {
				cursor: 0,
				attempts: [],
				flags: [flag('2026-10-10T13:00:00.000Z', 'a', { id: 'dupe' }), flag('2026-10-10T14:00:00.000Z', 'b', { id: 'dupe' })]
			});
			expect(result.flags.find((f) => f.id === 'dupe')?.note).toBe('b');
		});

		it('pages a large history and reports when more remains', async () => {
			const bulk = Array.from({ length: SYNC_PAGE + 5 }, (_, i) => attempt(`bulk${i}`, { questionId: `bq${i}` }));
			const sent = await repo.sync(userId, { cursor: 0, attempts: bulk, flags: [] });
			expect(sent.attempts).toHaveLength(SYNC_PAGE);
			expect(sent.more).toBe(true);

			const seen = new Set(sent.attempts.map((a) => a.id));
			let cursor = sent.cursor;
			let more = sent.more;
			while (more) {
				const next = await repo.sync(userId, { cursor, attempts: [], flags: [] });
				next.attempts.forEach((a) => seen.add(a.id));
				cursor = next.cursor;
				more = next.more;
			}
			expect(bulk.every((a) => seen.has(a.id))).toBe(true);
		});
	});
}

contract('memory', async () => createMemoryRepo());

describe('postgres', () => {
	let server: PGLiteSocketServer | null = null;
	let db: PGlite | null = null;
	let sql: Sql;
	let repo: Repo;

	beforeAll(async () => {
		let url = process.env.TEST_DATABASE_URL;
		if (!url) {
			db = await PGlite.create();
			server = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1' });
			await server.start();
			const address = server.getServerConn?.() ?? '';
			url = `postgres://postgres:postgres@${address}/postgres`;
		}
		// PGlite serves one connection at a time.
		sql = postgres(url, { max: 1, onnotice: () => {} });
		await migrate(sql);
		repo = createRepo(sql);
	}, 60_000);

	afterAll(async () => {
		await sql?.end({ timeout: 1 });
		await server?.stop();
		await db?.close();
	});

	it('runs the bootstrap twice without error', async () => {
		await migrate(sql);
		await migrate(sql);
	});

	contract('sql', async () => repo);
});
