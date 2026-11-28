<script lang="ts">
	import type { Snippet } from 'svelte';
	import HeaderButton from './HeaderButton.svelte';
	import Icon from './Icon.svelte';

	let { open = $bindable(false), title, onback, children, surface = 'card' }: {
		open?: boolean; title: string; onback?: () => void; children: Snippet; surface?: 'card' | 'page';
	} = $props();
	let dialog: HTMLDialogElement;
	let heading: HTMLHeadingElement;
	let previousTitle: string | undefined;
	const titleId = $props.id();

	$effect(() => {
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	// Nested views replace their opener. Give keyboard and screen-reader users the new title.
	$effect(() => {
		if (open && previousTitle && title !== previousTitle) heading.focus();
		previousTitle = open ? title : undefined;
	});

	function close() {
		dialog.close();
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog bind:this={dialog} class:page={surface === 'page'} aria-labelledby={titleId}
	onclose={() => (open = false)} onclick={(event) => { if (event.target === dialog) close(); }}>
	<div class="view">
		<header>
			{#if onback}
				<HeaderButton label="Back" onclick={onback}><span aria-hidden="true">←</span></HeaderButton>
			{/if}
			<h2 bind:this={heading} tabindex="-1" id={titleId}>{title}</h2>
			<HeaderButton label="Close" onclick={close}><Icon name="close" /></HeaderButton>
		</header>
		<div class="content">{@render children()}</div>
	</div>
</dialog>

<style>
	dialog {
		inset: 0 0 0 auto;
		margin: 0;
		padding: 0;
		border: 0;
		width: 100%;
		max-width: 100%;
		height: 100dvh;
		max-height: 100dvh;
		background: var(--color-surface-card);
		color: var(--color-text-primary);
	}
	:global(body):has(dialog[open]) { overflow: hidden; }
	dialog.page { background: var(--color-surface-page); }
	dialog::backdrop { background: color-mix(in srgb, var(--color-surface-page) 40%, transparent); }
	:global([data-view='drawer']) dialog {
		width: 400px;
		border-left: 1px solid var(--color-border-default);
	}
	.view {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: env(safe-area-inset-top) max(16px, var(--safe-right)) env(safe-area-inset-bottom) 16px;
	}
	header { display: flex; align-items: center; gap: 12px; padding: 20px 0; }
	h2 { flex: 1; font-size: var(--text-heading-size); }
	.content { overflow: auto; overscroll-behavior: contain; }
</style>
