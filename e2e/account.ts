import { createHash, randomBytes } from 'node:crypto';
import type { APIRequestContext, BrowserContext } from '@playwright/test';
import postgres from 'postgres';

const DATABASE_URL = 'postgres://postgres:postgres@127.0.0.1:54329/postgres';

export interface TestAccount {
	/** The session cookie value, so a second browser context can be "the other device". */
	token: string;
	email: string;
}

/**
 * Creates a user and a live session directly in the test database and returns
 * the cookie that proves it. The Google hop itself cannot run in a test, so
 * this stands in for a finished sign-in; everything after it is the real app.
 */
export async function createAccount(request: APIRequestContext, email = 'me@example.com'): Promise<TestAccount> {
	// The app creates its tables on the first API request.
	const probe = await request.get('/api/me');
	if (probe.status() !== 200) throw new Error(`the app has no database in this run: ${probe.status()}`);

	// The simple query protocol, with generated values only: PGlite's connection multiplexer can
	// lose the unnamed portal of an extended-protocol statement when several workers connect at once.
	const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {}, prepare: false });
	try {
		const token = randomBytes(32).toString('base64url');
		const sub = `e2e-${randomBytes(8).toString('hex')}`;
		const hash = createHash('sha256').update(token).digest('hex');
		const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;
		const expires = new Date(Date.now() + 30 * 86_400_000).toISOString();
		await sql.unsafe(`
			WITH created AS (
				INSERT INTO users (google_sub, email, name) VALUES (${quote(sub)}, ${quote(email)}, NULL) RETURNING id
			)
			INSERT INTO sessions (token_hash, user_id, expires_at)
			SELECT ${quote(hash)}, id, ${quote(expires)}::timestamptz FROM created
		`);
		return { token, email };
	} finally {
		await sql.end({ timeout: 1 });
	}
}

/** Makes this browser context a signed-in device of the account. */
export async function signIn(context: BrowserContext, account: TestAccount, baseURL: string) {
	await context.addCookies([{ name: 'session', value: account.token, url: baseURL, httpOnly: true, sameSite: 'Lax' }]);
}

/** What the server holds for the account, read through the real sync endpoint. */
export async function serverState(request: APIRequestContext, account: TestAccount, baseURL: string) {
	const response = await request.post('/api/sync', {
		headers: { cookie: `session=${account.token}`, origin: baseURL },
		data: { cursor: 0, attempts: [], flags: [] }
	});
	if (!response.ok()) throw new Error(`sync failed: ${response.status()}`);
	return (await response.json()) as {
		attempts: { questionId: string; correct: boolean }[];
		flags: { id: string; removed?: boolean }[];
	};
}
