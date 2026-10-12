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
	/** The browser reports no connection. Answers are saved here and sync later. */
	offline: false,
	syncing: false,
	/** The last sync attempt failed. It retries on the next trigger. */
	failed: false,
	/** Bumps whenever a sync changes local data, so views can re-read it. */
	version: 0
});

const api = createSyncApi();
const DEBOUNCE_MS = 1500;
const HINT_KEY = 'coding-drills:v1:account';

/** Who was signed in last time, so an offline start still knows. The server remains the authority. */
function readHint(): Me | null {
	try {
		const raw = localStorage.getItem(HINT_KEY);
		const parsed: unknown = raw ? JSON.parse(raw) : null;
		if (typeof parsed === 'object' && parsed !== null && typeof (parsed as Me).email === 'string') {
			return parsed as Me;
		}
	} catch {
		// Blocked or corrupt storage: behave as if there was no hint.
	}
	return null;
}

function writeHint(user: Me | null): void {
	try {
		if (user) localStorage.setItem(HINT_KEY, JSON.stringify(user));
		else localStorage.removeItem(HINT_KEY);
	} catch {
		// Not remembering the account only costs the offline label.
	}
}

let initPromise: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let again = false;

async function probe(): Promise<void> {
	const me = await api.me();
	if (me.kind === 'signedIn') {
		account.status = 'signedIn';
		account.user = me.user;
		writeHint(me.user);
	} else if (me.kind === 'signedOut') {
		account.status = 'signedOut';
		account.user = null;
		writeHint(null);
	} else if (me.kind === 'unavailable') {
		account.status = 'unavailable';
		account.user = null;
	} else if (account.status === 'unknown') {
		// Offline or unreachable: trust the last known account until the server says otherwise.
		const hint = readHint();
		if (hint) {
			account.status = 'signedIn';
			account.user = hint;
		}
	}
}

export async function syncNow(): Promise<void> {
	await initSync();
	if (account.status === 'unknown') await probe();
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
		account.offline = navigator.onLine === false;
		window.addEventListener('offline', () => {
			account.offline = true;
		});
		window.addEventListener('online', () => {
			account.offline = false;
			void syncNow();
		});
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
	writeHint(null);
}
