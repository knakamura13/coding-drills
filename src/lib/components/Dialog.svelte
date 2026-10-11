<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		label: string;
		onclose: () => void;
		children: Snippet;
	}

	let { open, label, onclose, children }: Props = $props();

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
</script>

<!-- A click on the backdrop lands on the dialog element itself. Escape covers keyboard users. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog bind:this={dialog} aria-label={label} {onclose} onclick={closeOnBackdrop}>
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
</style>
