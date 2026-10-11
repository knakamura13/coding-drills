import { getRepository } from '$lib/storage';
import { createSyncApi } from './api';
import { runSync } from './engine';
import type { Me } from './protocol';

/**
 * Account and sync state for the page. Signed out, the app is fully local and
 * nothing here runs against the server. Signed in, attempts and flags sync in
 * the background: on load, shortly after each answer, when the tab becomes
 * visible again, and when the connection returns.
 */

export type AccountStatus = 'unknown' | 'unavailable' | 'signedOut' | 'signedIn';

export const account = $state({
	status: 'unknown' as AccountStatus,
	user: null as Me | null,
	syncing: false,
	/** The last sync attempt failed. It retries on the next trigger. */
	failed: false,
	/** Bumps whenever a sync changes local data, so views can re-read it. */
	version: 0
});

const api = createSyncApi();
const DEBOUNCE_MS = 1500;

let initPromise: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let again = false;

async function probe(): Promise<void> {
	const me = await api.me();
	if (me.kind === 'signedIn') {
		account.status = 'signedIn';
		account.user = me.user;
	} else if (me.kind === 'signedOut') {
		account.status = 'signedOut';
		account.user = null;
	} else if (me.kind === 'unavailable') {
		account.status = 'unavailable';
		account.user = null;
	}
	// 'failed' (offline): keep what we knew and try again on the next trigger.
}

export async function syncNow(): Promise<void> {
	await initSync();
	if (account.status !== 'signedIn') return;
	if (running) {
		again = true;
		return;
	}
	running = true;
	account.syncing = true;
	try {
		do {
			again = false;
			const outcome = await runSync(getRepository(), api);
			if (outcome.status === 'signedOut') {
				account.status = 'signedOut';
				account.user = null;
				account.failed = false;
				return;
			}
			account.failed = outcome.status === 'failed';
			if (outcome.status === 'ok' && outcome.changed) account.version += 1;
		} while (again);
	} finally {
		running = false;
		account.syncing = false;
	}
}

/** Syncs shortly from now, so a burst of answers becomes one request. */
export function syncSoon(): void {
	if (account.status === 'signedOut' || account.status === 'unavailable') return;
	clearTimeout(timer);
	timer = setTimeout(() => void syncNow(), DEBOUNCE_MS);
}

/** Probes the account once per page load, starts the background triggers, and runs the first sync. */
export function initSync(): Promise<void> {
	initPromise ??= (async () => {
		await probe();
		if (typeof window === 'undefined') return;
		window.addEventListener('online', () => void syncNow());
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') void syncNow();
		});
		if (account.status === 'signedIn') void syncNow();
	})();
	return initPromise;
}

export async function signOut(): Promise<void> {
	clearTimeout(timer);
	await api.signOut();
	account.status = 'signedOut';
	account.user = null;
	account.failed = false;
}
