/**
 * repo.ts: every SQL statement the API uses, behind plain async methods.
 *
 * Route handlers depend on this interface, not on postgres.js, so they can be
 * tested with an in-memory fake. The real queries run against Postgres in
 * `repo.integration.test.ts`, which also runs the fake through the same
 * contract so the two cannot drift.
 */

import { SYNC_PAGE, type SyncRequest, type SyncResponse } from '$lib/sync/protocol';
import type { Attempt, Flag } from '$lib/storage/types';
import type { Sql } from './db';

export interface SessionUser {
	id: number;
	email: string;
	name: string | null;
}

export interface Repo {
	/** Find-or-create by the stable Google account id; refreshes email and name. */
	upsertUser(googleSub: string, email: string, name: string | null): Promise<SessionUser>;
	createSession(tokenHash: string, userId: number, expiresAt: Date): Promise<void>;
	/** The live user for a session (with its expiry), or null when missing or expired. */
	userForSession(tokenHash: string, now: Date): Promise<{ user: SessionUser; expiresAt: Date } | null>;
	extendSession(tokenHash: string, expiresAt: Date): Promise<void>;
	deleteSession(tokenHash: string): Promise<void>;
	/**
	 * Stores the request's attempts (ignoring ids already held) and flags (the
	 * newer copy wins), then returns what the device is missing.
	 */
	sync(userId: number, request: SyncRequest): Promise<SyncResponse>;
}

interface UserRow {
	id: number;
	email: string;
	name: string | null;
}

/** Keeps the newest copy of each flag id. A tie keeps the first. */
export function newestFlags(flags: readonly Flag[]): Flag[] {
	const byId = new Map<string, Flag>();
	for (const flag of flags) {
		const held = byId.get(flag.id);
		if (!held || flag.at > held.at) byId.set(flag.id, flag);
	}
	return [...byId.values()];
}

export function createRepo(sql: Sql): Repo {
	return {
		async upsertUser(googleSub, email, name) {
			const rows = await sql<UserRow[]>`
				INSERT INTO users (google_sub, email, name)
				VALUES (${googleSub}, ${email}, ${name})
				ON CONFLICT (google_sub)
				DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name
				RETURNING id, email, name
			`;
			return rows[0];
		},

		async createSession(tokenHash, userId, expiresAt) {
			await sql`
				INSERT INTO sessions (token_hash, user_id, expires_at)
				VALUES (${tokenHash}, ${userId}, ${expiresAt})
			`;
		},

		async userForSession(tokenHash, now) {
			const rows = await sql<(UserRow & { expires_at: Date })[]>`
				SELECT u.id, u.email, u.name, s.expires_at
				FROM sessions s JOIN users u ON u.id = s.user_id
				WHERE s.token_hash = ${tokenHash} AND s.expires_at > ${now}
			`;
			if (!rows.length) return null;
			const { expires_at, ...user } = rows[0];
			return { user, expiresAt: expires_at };
		},

		async extendSession(tokenHash, expiresAt) {
			await sql`UPDATE sessions SET expires_at = ${expiresAt} WHERE token_hash = ${tokenHash}`;
		},

		async deleteSession(tokenHash) {
			await sql`DELETE FROM sessions WHERE token_hash = ${tokenHash}`;
		},

		async sync(userId, request) {
			return sql.begin(async (tx) => {
				// One writer per user at a time, so seq order is commit order and a device
				// that has read up to N can never miss a row below N that commits later.
				await tx`SELECT pg_advisory_xact_lock(${userId})`;

				if (request.attempts.length > 0) {
					const rows = tx.json(request.attempts.map((attempt) => ({ id: attempt.id, data: attempt })) as never);
					await tx`
						INSERT INTO attempts (user_id, id, data)
						SELECT ${userId}, x.id, x.data
						FROM jsonb_to_recordset(${rows}::jsonb) AS x(id text, data jsonb)
						ON CONFLICT (user_id, id) DO NOTHING
					`;
				}

				if (request.flags.length > 0) {
					const rows = tx.json(
						newestFlags(request.flags).map((flag) => ({ id: flag.id, at: flag.at, data: flag })) as never
					);
					await tx`
						INSERT INTO flags (user_id, id, at, data)
						SELECT ${userId}, x.id, x.at, x.data
						FROM jsonb_to_recordset(${rows}::jsonb) AS x(id text, at text, data jsonb)
						ON CONFLICT (user_id, id)
						DO UPDATE SET at = EXCLUDED.at, data = EXCLUDED.data
						WHERE EXCLUDED.at > flags.at
					`;
				}

				const attempts = await tx<{ seq: number; data: Attempt }[]>`
					SELECT seq, data FROM attempts
					WHERE user_id = ${userId} AND seq > ${request.cursor}
					ORDER BY seq
					LIMIT ${SYNC_PAGE + 1}
				`;
				const more = attempts.length > SYNC_PAGE;
				const page = more ? attempts.slice(0, SYNC_PAGE) : attempts;
				const flags = await tx<{ data: Flag }[]>`SELECT data FROM flags WHERE user_id = ${userId}`;

				return {
					cursor: page.length > 0 ? page[page.length - 1].seq : request.cursor,
					attempts: page.map((row) => row.data),
					flags: flags.map((row) => row.data),
					more
				};
			}) as Promise<SyncResponse>;
		}
	};
}
