import type { RequestHandler } from './$types';

/** Railway's healthcheck target (see .railway/railway.ts). */
export const GET: RequestHandler = () =>
	new Response('ok', {
		headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
	});
