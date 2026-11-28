<!--
	The app's dialog (lesson Round 2 rule): a bottom sheet in phone portrait, a centered 560px dialog on desktop
	and in landscape, over a 70% Midnight scrim. A native <dialog> opened with showModal(), so focus stays
	inside, the page behind is inert, Escape closes it and focus returns to the control that opened
	it. A tap on the scrim closes it too. Slides up in 300 ms; with Reduce effects it only fades.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open = $bindable(false),
		title,
		children,
		actions,
		onclose
	}: {
		open?: boolean;
		title: string;
		children?: Snippet;
		actions?: Snippet;
		onclose?: () => void;
	} = $props();

	let dialog: HTMLDialogElement;
	const titleId = $props.id();

	$effect(() => {
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	function closed() {
		open = false;
		onclose?.();
	}

	// A click on the dialog element itself, outside the panel, is a click on the scrim.
	function clickScrim(event: MouseEvent) {
		if (event.target === dialog) dialog.close();
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog bind:this={dialog} class="sheet" aria-labelledby={titleId} onclose={closed} onclick={clickScrim}>
	<div class="panel">
		<span class="grabber" aria-hidden="true"></span>
		<h2 class="title" id={titleId}>{title}</h2>
		{#if children}<div class="body">{@render children()}</div>{/if}
		{#if actions}<div class="actions">{@render actions()}</div>{/if}
	</div>
</dialog>

<style>
	.sheet {
		/* Phone: a bottom sheet. */
		inset: auto 0 0;
		margin: 0;
		width: 100%;
		max-width: 100%;
		max-height: calc(100dvh - var(--space-8));
		padding: 0;
		border: 1px solid var(--color-border-default);
		border-bottom: 0;
		border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
		background: var(--color-surface-card);
		color: var(--color-text-primary);
		overflow-y: auto;
		overscroll-behavior: contain;
		opacity: 1;
		transform: none;
		transition:
			transform var(--dur-sheet) var(--ease),
			opacity var(--dur-sheet) var(--ease),
			overlay var(--dur-sheet) var(--ease) allow-discrete,
			display var(--dur-sheet) var(--ease) allow-discrete;
	}

	.sheet:not([open]) {
		opacity: 0;
		transform: translateY(calc(100% * var(--shift)));
	}

	@starting-style {
		.sheet[open] {
			opacity: 0;
			transform: translateY(calc(100% * var(--shift)));
		}
	}

	.sheet::backdrop {
		background: var(--color-scrim);
		opacity: 1;
		transition:
			opacity var(--dur-sheet) var(--ease),
			overlay var(--dur-sheet) var(--ease) allow-discrete,
			display var(--dur-sheet) var(--ease) allow-discrete;
	}

	.sheet:not([open])::backdrop {
		opacity: 0;
	}

	@starting-style {
		.sheet[open]::backdrop {
			opacity: 0;
		}
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-screen-edge) max(var(--space-4), env(safe-area-inset-bottom));
	}

	.grabber {
		align-self: center;
		width: 36px;
		height: 4px;
		border-radius: 2px;
		background: var(--color-border-strong);
	}

	.title {
		font-size: var(--text-heading-size);
		line-height: var(--text-heading-line);
		font-weight: var(--text-heading-weight);
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding-top: var(--space-1);
	}

	/* Desktop and landscape share the panel. Landscape keeps actions stacked. */
	:global([data-dialog="centered"]) .sheet {
		inset: 0;
		margin: auto;
		width: min(560px, calc(100% - 2 * max(var(--safe-left), var(--safe-right), 16px)));
		max-height: calc(100dvh - 2 * var(--space-8));
		border-bottom: 1px solid var(--color-border-default);
		border-radius: var(--radius-sheet);
	}

	:global([data-dialog="centered"]) .sheet:not([open]),
	:global([data-dialog="centered"]) .sheet[open] {
		--rise: calc(var(--space-2) * var(--shift));
	}

	:global([data-dialog="centered"]) .sheet:not([open]) {
		transform: translateY(var(--rise));
	}

	@starting-style {
		:global([data-dialog="centered"]) .sheet[open] {
			transform: translateY(var(--rise));
		}
	}

	:global([data-dialog="centered"]) .panel {
		gap: var(--space-4);
		padding: var(--space-6);
	}

	:global([data-dialog="centered"]) .grabber {
		display: none;
	}

	:global([data-layout="desktop"]) .actions {
		flex-direction: row;
		justify-content: flex-end;
	}

	:global([data-layout="desktop"]) .actions :global(.button) {
		width: auto;
		min-width: 160px;
	}
	:global([data-layout="landscape"]) .panel {
		gap: var(--space-3);
	}

	:global([data-layout="landscape"]) .actions {
		padding-top: 0;
	}
</style>
