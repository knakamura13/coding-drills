/**
 * Arrow keys, Home and End move focus between the buttons of a group, and only one of them sits
 * in the tab order. Enter and Space still press the focused button. Used where a press answers at
 * once, so moving between answers must not pick one, as arrow keys in a radio group would.
 * Attach to each button's keydown; the group is the fieldset around them.
 */
export function roving(event: KeyboardEvent): void {
	const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
	if (step === undefined && event.key !== 'Home' && event.key !== 'End') return;
	const group = (event.currentTarget as HTMLElement).closest('fieldset');
	if (!group) return;
	const buttons = [...group.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
	const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
	if (at < 0) return;
	const last = buttons.length - 1;
	const next = event.key === 'Home' ? 0 : event.key === 'End' ? last : Math.min(last, Math.max(0, at + step!));
	event.preventDefault();
	buttons.forEach((button, index) => (button.tabIndex = index === next ? 0 : -1));
	buttons[next].focus();
}
