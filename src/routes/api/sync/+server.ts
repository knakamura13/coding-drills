/**
 * POST /api/sync: exchange attempts and flags with the server.
 *
 * The server stores events and never merges schedules: devices replay the
 * attempts themselves. Retrying a request is always safe, because attempts are
 * stored by id and flags by newest timestamp.
 */

import type { RequestHandler } from './$types';
import { jsonResponse, readJsonBody } from '$lib/server/http';
import { parseAttempt, parseFlag } from '$lib/storage/guards';
import { MAX_CURSOR, MAX_FLAGS, MAX_SYNC_BODY_BYTES, SYNC_BATCH, type SyncRequest } from '$lib/sync/protocol';

export const prerender = false;

function parseRequest(body: unknown): SyncRequest | null {
	if (typeof body !== 'object' || body === null) return null;
	const { cursor, attempts, flags } = body as Record<string, unknown>;
	if (typeof cursor !== 'number' || !Number.isInteger(cursor) || cursor < 0 || cursor > MAX_CURSOR) return null;
	if (!Array.isArray(attempts) || attempts.length > SYNC_BATCH * 2) return null;
	if (!Array.isArray(flags) || flags.length > MAX_FLAGS) return null;
	// Rebuilt from known fields, so unknown keys never reach storage or another device.
	const cleanAttempts = attempts.map(parseAttempt);
	const cleanFlags = flags.map(parseFlag);
	if (!cleanAttempts.every((attempt) => attempt !== null) || !cleanFlags.every((flag) => flag !== null)) return null;
	return { cursor, attempts: cleanAttempts, flags: cleanFlags };
}

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.repo) return jsonResponse({ error: 'accounts unavailable' }, 503);
	if (!locals.user) return jsonResponse({ error: 'sign in first' }, 401);

	const parsed = parseRequest(await readJsonBody(request, MAX_SYNC_BODY_BYTES));
	if (!parsed) return jsonResponse({ error: 'bad request' }, 400);

	const page = await locals.repo.sync(locals.user.id, parsed);
	return jsonResponse({ ...page, account: locals.user.id });
};
