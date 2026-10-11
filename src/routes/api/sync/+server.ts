/**
 * POST /api/sync: exchange attempts and flags with the server.
 *
 * The server stores events and never merges schedules: devices replay the
 * attempts themselves. Retrying a request is always safe, because attempts are
 * stored by id and flags by newest timestamp.
 */

import type { RequestHandler } from './$types';
import { jsonResponse, readJsonBody } from '$lib/server/http';
import { isAttempt, isFlag } from '$lib/storage/guards';
import { MAX_FLAGS, MAX_SYNC_BODY_BYTES, SYNC_BATCH, type SyncRequest } from '$lib/sync/protocol';

export const prerender = false;

function parseRequest(body: unknown): SyncRequest | null {
	if (typeof body !== 'object' || body === null) return null;
	const { cursor, attempts, flags } = body as Record<string, unknown>;
	if (typeof cursor !== 'number' || !Number.isInteger(cursor) || cursor < 0) return null;
	if (!Array.isArray(attempts) || attempts.length > SYNC_BATCH * 2) return null;
	if (!Array.isArray(flags) || flags.length > MAX_FLAGS) return null;
	if (!attempts.every(isAttempt) || !flags.every(isFlag)) return null;
	return { cursor, attempts, flags };
}

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.repo) return jsonResponse({ error: 'accounts unavailable' }, 503);
	if (!locals.user) return jsonResponse({ error: 'sign in first' }, 401);

	const parsed = parseRequest(await readJsonBody(request, MAX_SYNC_BODY_BYTES));
	if (!parsed) return jsonResponse({ error: 'bad request' }, 400);

	return jsonResponse(await locals.repo.sync(locals.user.id, parsed));
};
