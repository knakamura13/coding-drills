/**
 * db.ts: lazy Postgres access for the account API.
 *
 * The database is optional. Without DATABASE_URL every API route answers
 * "unavailable" and the client runs as the local-only app. Nothing here may
 * run at build time (prerendering executes hooks, and Railway's private
 * network does not exist inside `docker build`), so the connection is made on
 * first use and everything is gated on `building`.
 *
 * Schema changes are an idempotent bootstrap (CREATE IF NOT EXISTS) run once
 * per process before the first query. Four small tables for one user do not
 * need a migrations framework. If a column is ever altered, add a
 * schema_version table first.
 */

import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import postgres from 'postgres';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
	id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	google_sub  text UNIQUE NOT NULL,
	email       text NOT NULL,
	name        text,
	created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
	token_hash  text PRIMARY KEY,
	user_id     integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	expires_at  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

-- Append-only. seq orders events by arrival so a device can ask for "everything after N".
CREATE TABLE IF NOT EXISTS attempts (
	user_id  integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	id       text NOT NULL,
	seq      integer GENERATED ALWAYS AS IDENTITY,
	data     jsonb NOT NULL,
	PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS attempts_user_seq_idx ON attempts(user_id, seq);

-- Last write wins by "at". A deleted flag is a row whose data says removed.
CREATE TABLE IF NOT EXISTS flags (
	user_id  integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	id       text NOT NULL,
	at       text NOT NULL,
	data     jsonb NOT NULL,
	PRIMARY KEY (user_id, id)
);
`;

export type Sql = postgres.Sql;

let ready: Promise<Sql> | null = null;

/** Idempotent bootstrap. Exported so tests can run it on a fresh database. */
export async function migrate(sql: Sql): Promise<void> {
	await sql.unsafe(SCHEMA);
}

/**
 * The connected, migrated client, or null when no database is configured (or
 * at build time). Callers treat null as "run as the local-only app".
 */
export function getDb(): Promise<Sql> | null {
	if (building) return null;
	const url = env.DATABASE_URL;
	if (!url) return null;
	if (!ready) {
		const sql = postgres(url, { max: 5, onnotice: () => {} });
		ready = migrate(sql).then(() => sql);
		// A failed bootstrap must not poison every later request.
		ready.catch(() => {
			ready = null;
		});
	}
	return ready;
}
