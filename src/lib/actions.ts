/** Moves focus to the element when it mounts, so keyboard and screen-reader users land on new content. */
export function focusOnMount(node: HTMLElement) {
	node.focus({ preventScroll: true });
}
