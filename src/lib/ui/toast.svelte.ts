/**
 * A short message at the top of the screen. `<Toast/>` is mounted once in the root layout and
 * announces each message politely to screen readers.
 */

export const TOAST_MS = 2400;

export const toastState = $state({ message: '', visible: false });

let timer: ReturnType<typeof setTimeout> | undefined;

/** Shows `message` for `ms` milliseconds, replacing any message still showing. */
export function toast(message: string, ms = TOAST_MS): void {
	toastState.message = message;
	toastState.visible = true;
	clearTimeout(timer);
	timer = setTimeout(() => {
		toastState.visible = false;
	}, ms);
}
