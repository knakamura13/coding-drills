import { describe, expect, it } from 'vitest';
import { decodeIdToken, exchangeGoogleCode, googleAuthorizeUrl, isAllowedEmail, pkceChallenge } from './googleOauth';

function idToken(payload: unknown): string {
	const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
	return `${part({ alg: 'RS256' })}.${part(payload)}.signature`;
}

describe('isAllowedEmail', () => {
	it('matches a listed address ignoring case and spacing', () => {
		expect(isAllowedEmail('Me@Example.com', ' me@example.com , other@example.com ')).toBe(true);
		expect(isAllowedEmail('other@example.com', 'me@example.com,other@example.com')).toBe(true);
	});

	it('rejects everyone when the list is missing or empty, so a missing variable fails closed', () => {
		expect(isAllowedEmail('me@example.com', undefined)).toBe(false);
		expect(isAllowedEmail('me@example.com', '')).toBe(false);
		expect(isAllowedEmail('me@example.com', ' , ')).toBe(false);
	});

	it('does not match on a substring or a different domain', () => {
		expect(isAllowedEmail('me@example.com.evil.io', 'me@example.com')).toBe(false);
		expect(isAllowedEmail('xme@example.com', 'me@example.com')).toBe(false);
	});
});

describe('decodeIdToken', () => {
	it('reads the subject, email, and whether Google verified the email', () => {
		expect(decodeIdToken(idToken({ sub: '1', email: 'a@b.c', email_verified: true, name: 'A' }))).toEqual({
			sub: '1',
			email: 'a@b.c',
			emailVerified: true,
			name: 'A'
		});
	});

	it('treats a missing or non-true email_verified as unverified', () => {
		expect(decodeIdToken(idToken({ sub: '1', email: 'a@b.c' }))?.emailVerified).toBe(false);
		expect(decodeIdToken(idToken({ sub: '1', email: 'a@b.c', email_verified: 'true' }))?.emailVerified).toBe(false);
	});

	it('rejects malformed tokens', () => {
		expect(decodeIdToken('nope')).toBeNull();
		expect(decodeIdToken(idToken({ sub: 1 }))).toBeNull();
		expect(decodeIdToken('a.!!!.c')).toBeNull();
	});
});

describe('authorization request', () => {
	it('asks for the minimum scope with PKCE', () => {
		const url = new URL(googleAuthorizeUrl({ clientId: 'cid', redirectUri: 'https://x/cb', state: 's', codeVerifier: 'v' }));
		expect(url.searchParams.get('scope')).toBe('openid email');
		expect(url.searchParams.get('code_challenge')).toBe(pkceChallenge('v'));
		expect(url.searchParams.get('code_challenge_method')).toBe('S256');
		expect(url.searchParams.get('redirect_uri')).toBe('https://x/cb');
	});

	it('exchanges the code and returns the identity, or null on any failure', async () => {
		const ok = (async () => new Response(JSON.stringify({ id_token: idToken({ sub: '1', email: 'a@b.c', email_verified: true }) }))) as typeof fetch;
		const opts = { code: 'c', codeVerifier: 'v', clientId: 'id', clientSecret: 's', redirectUri: 'r' };
		expect((await exchangeGoogleCode({ ...opts, fetchFn: ok }))?.email).toBe('a@b.c');
		expect(await exchangeGoogleCode({ ...opts, fetchFn: (async () => new Response('no', { status: 400 })) as typeof fetch })).toBeNull();
		expect(await exchangeGoogleCode({ ...opts, fetchFn: (async () => { throw new Error('offline'); }) as typeof fetch })).toBeNull();
		expect(await exchangeGoogleCode({ ...opts, fetchFn: (async () => new Response('{}')) as typeof fetch })).toBeNull();
	});
});
