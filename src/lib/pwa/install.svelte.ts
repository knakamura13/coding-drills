/**
 * What the app can offer for installing it to the home screen.
 *
 * Chromium browsers fire `beforeinstallprompt`, which can be held and replayed
 * from a button. Safari on iPhone has no prompt: the only way is Share, then
 * Add to Home Screen, so it gets a one-line instruction instead.
 */

interface InstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'coding-drills:v1:install-dismissed';

export const install = $state({
	/** A held browser prompt is ready, so an Install button can be shown. */
	canPrompt: false,
	/** iPhone or iPad Safari in a tab: show the Add to Home Screen instruction. */
	showIosHint: false
});

let held: InstallPromptEvent | null = null;
let started = false;

export function isStandalone(): boolean {
	return (
		window.matchMedia('(display-mode: standalone)').matches ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true
	);
}

function isIos(): boolean {
	return (
		/iphone|ipad|ipod/i.test(navigator.userAgent) ||
		// iPadOS reports itself as a Mac with a touch screen.
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
	);
}

function wasDismissed(): boolean {
	try {
		return localStorage.getItem(DISMISSED_KEY) === '1';
	} catch {
		return false;
	}
}

/** Starts listening. Safe to call more than once. */
export function watchInstall(): void {
	if (started || typeof window === 'undefined') return;
	started = true;
	if (isStandalone()) return;

	window.addEventListener('beforeinstallprompt', (event) => {
		event.preventDefault();
		held = event as InstallPromptEvent;
		install.canPrompt = true;
	});
	window.addEventListener('appinstalled', () => {
		held = null;
		install.canPrompt = false;
		install.showIosHint = false;
	});
	install.showIosHint = isIos() && !wasDismissed();
}

export async function promptInstall(): Promise<void> {
	if (!held) return;
	const prompt = held;
	held = null;
	install.canPrompt = false;
	await prompt.prompt();
	await prompt.userChoice.catch(() => undefined);
}

export function dismissIosHint(): void {
	install.showIosHint = false;
	try {
		localStorage.setItem(DISMISSED_KEY, '1');
	} catch {
		// Not remembering only means the hint can show again.
	}
}
