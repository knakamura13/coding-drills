/**
 * GET /api/me: who am I, and does this deployment have accounts at all?
 *
 * Never 401s: `{user: null}` is the signed-out answer, and 503 with the same
 * body means there is no database here. The client uses this as its feature
 * probe, so a deployment without accounts degrades to local-only.
 */

import type { RequestHandler } from './$types';
import { jsonResponse } from '$lib/server/http';

export const prerender = false;

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.repo) return jsonResponse({ user: null }, 503);
	if (!locals.user) return jsonResponse({ user: null });
	return jsonResponse({ user: { email: locals.user.email, name: locals.user.name } });
};
