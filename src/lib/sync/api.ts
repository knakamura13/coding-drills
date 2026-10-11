import type { Me, SyncRequest, SyncResponse } from './protocol';

export type MeResult =
	/** This deployment has no accounts (no database), or the request never reached the server. */
	| { kind: 'unavailable' }
	| { kind: 'signedOut' }
	| { kind: 'signedIn'; user: Me }
	| { kind: 'failed' };

export type SyncResult = { kind: 'ok'; response: SyncResponse } | { kind: 'unauthorized' } | { kind: 'failed' };

export interface SyncApi {
	me(): Promise<MeResult>;
	sync(request: SyncRequest): Promise<SyncResult>;
	signOut(): Promise<void>;
}

/** The browser side of the account API. Never throws: failures come back as results. */
export function createSyncApi(fetchFn: typeof fetch = (...args) => fetch(...args)): SyncApi {
	return {
		async me() {
			try {
				const res = await fetchFn('/api/me', { headers: { accept: 'application/json' } });
				if (res.status === 503 || res.status === 404) return { kind: 'unavailable' };
				if (!res.ok) return { kind: 'failed' };
				const body = (await res.json()) as { user: Me | null };
				return body.user ? { kind: 'signedIn', user: body.user } : { kind: 'signedOut' };
			} catch {
				return { kind: 'failed' };
			}
		},

		async sync(request) {
			try {
				const res = await fetchFn('/api/sync', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(request)
				});
				if (res.status === 401) return { kind: 'unauthorized' };
				if (!res.ok) return { kind: 'failed' };
				return { kind: 'ok', response: (await res.json()) as SyncResponse };
			} catch {
				return { kind: 'failed' };
			}
		},

		async signOut() {
			try {
				await fetchFn('/api/auth/logout', { method: 'POST' });
			} catch {
				// Offline: the cookie stays, and the next sign-out attempt clears it.
			}
		}
	};
}
