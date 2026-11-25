import { isRedirect } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';

// e2e runs with a malformed client ID, so only this test reaches the hop to Google.
vi.mock('$app/env', () => ({ dev: false }));
vi.mock('$app/env/private', () => ({
	GOOGLE_CLIENT_ID: '123-abc.apps.googleusercontent.com',
	GOOGLE_CLIENT_SECRET: 'test-secret'
}));

const { GET } = await import('./+server');

describe('GET /api/auth/google', () => {
	it('redirects to Google with the callback on the request origin', async () => {
		const cookies = { set: vi.fn() };
		const event = { cookies, url: new URL('https://facetlearning.app/api/auth/google') };
		const thrown = await Promise.resolve()
			.then(() => GET(event as never))
			.catch((error: unknown) => error);

		expect(isRedirect(thrown)).toBe(true);
		const location = new URL((thrown as { location: string }).location);
		expect(location.origin).toBe('https://accounts.google.com');
		expect(location.searchParams.get('redirect_uri')).toBe(
			'https://facetlearning.app/api/auth/google/callback'
		);
		expect(cookies.set.mock.calls.map(([name]) => name)).toEqual(['oauth_state', 'oauth_verifier']);
	});
});
