<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		label: string;
		/** A bottom sheet, or a drawer that slides in from the left edge. */
		variant?: 'sheet' | 'drawer';
		onclose: () => void;
		children: Snippet;
	}

	let { open, label, variant = 'sheet', onclose, children }: Props = $props();

	let dialog: HTMLDialogElement | undefined = $state();

	// The native <dialog> supplies the focus trap, Escape handling, and backdrop.
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	function closeOnBackdrop(event: MouseEvent) {
		if (event.target === dialog) onclose();
	}

	const CONTROLS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

	// Tab and Shift+Tab stay inside an open dialog: from its last control Tab returns to the first, and back.
	// Native modality does not guarantee this in every browser, so the wrap is explicit.
	function keepTabInside(event: KeyboardEvent) {
		if (event.key !== 'Tab' || !dialog) return;
		const controls = [...dialog.querySelectorAll<HTMLElement>(CONTROLS)];
		if (controls.length === 0) return;
		const first = controls[0];
		const last = controls[controls.length - 1];
		const active = document.activeElement;
		if (event.shiftKey && (active === first || !dialog.contains(active))) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
			event.preventDefault();
			first.focus();
		}
	}
</script>

<!-- A click on the backdrop lands on the dialog element itself. Escape covers keyboard users. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog bind:this={dialog} class={variant} aria-label={label} {onclose} onclick={closeOnBackdrop} onkeydown={keepTabInside}>
	<div class="panel">{@render children()}</div>
</dialog>

<style>
	dialog {
		width: 100%;
		max-width: none;
		max-height: none;
		margin: auto 0 0;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		overflow: visible;
	}

	dialog::backdrop {
		background: var(--overlay);
	}

	/* The reference's sheet has a 16px corner radius and the handle 11.5px below its top edge. */
	.panel {
		max-width: var(--column);
		max-height: 90dvh;
		margin: 0 auto;
		padding: 11.5px var(--gutter) max(20px, calc(env(safe-area-inset-bottom) + 5.5px));
		overflow-y: auto;
		border-radius: 16px 16px 0 0;
		background: var(--bg);
		animation: rise 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	@keyframes rise {
		from {
			transform: translateY(32px);
			opacity: 0;
		}
		to {
			transform: none;
			opacity: 1;
		}
	}

	/* The navigation drawer: the full height of the screen, against the left edge. */
	dialog.drawer {
		inset: 0 auto 0 0;
		width: min(340px, 86vw);
		height: 100dvh;
		margin: 0;
	}

	dialog.drawer .panel {
		max-width: none;
		max-height: none;
		height: 100%;
		padding: max(20px, calc(env(safe-area-inset-top) + 12px)) 20px max(20px, env(safe-area-inset-bottom));
		border-radius: 0 16px 16px 0;
		animation: slide-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	@keyframes slide-in {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: none;
		}
	}
</style>
