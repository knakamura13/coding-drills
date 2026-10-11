/**
 * GET /api/auth/google/callback: finish the sign-in hop. Only the allow-listed
 * Google account gets a session. Every failure lands on /?auth=... with no
 * detail leaked.
 */

import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exchangeGoogleCode, isAllowedEmail } from '$lib/server/googleOauth';
import { SESSION_TTL_MS, newSessionToken, setSessionCookie } from '$lib/server/session';

export const prerender = false;

export const GET: RequestHandler = async ({ cookies, locals, url }) => {
	const state = cookies.get('oauth_state');
	const codeVerifier = cookies.get('oauth_verifier');
	cookies.delete('oauth_state', { path: '/' });
	cookies.delete('oauth_verifier', { path: '/' });

	const code = url.searchParams.get('code');
	const returnedState = url.searchParams.get('state');
	if (
		!locals.repo ||
		!code ||
		!state ||
		!codeVerifier ||
		!returnedState ||
		returnedState !== state ||
		!env.GOOGLE_CLIENT_ID ||
		!env.GOOGLE_CLIENT_SECRET
	) {
		redirect(302, '/?auth=failed');
	}

	const identity = await exchangeGoogleCode({
		code,
		codeVerifier,
		clientId: env.GOOGLE_CLIENT_ID,
		clientSecret: env.GOOGLE_CLIENT_SECRET,
		redirectUri: `${url.origin}/api/auth/google/callback`
	});
	if (!identity) redirect(302, '/?auth=failed');
	if (!identity.emailVerified || !isAllowedEmail(identity.email, env.ALLOWED_EMAILS)) {
		redirect(302, '/?auth=denied');
	}

	const user = await locals.repo.upsertUser(identity.sub, identity.email, identity.name);
	const { token, hash } = newSessionToken();
	await locals.repo.createSession(hash, user.id, new Date(Date.now() + SESSION_TTL_MS));
	setSessionCookie(cookies, token, !dev);

	redirect(302, '/');
};
