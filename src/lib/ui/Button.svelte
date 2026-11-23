<!--
	The lesson button (FigCraft Components: Button). One verb, one primary action per screen. Primary
	is neutral, Starlight with Midnight text; branch color never fills a button. Secondary is Dusk
	with a Twilight border (Retry, Quit). Full width, 52 tall. Focus uses the global ring in the
	branch accent, 2px outside.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	let {
		variant = 'primary',
		children,
		...rest
	}: { variant?: 'primary' | 'secondary'; children: Snippet } & HTMLButtonAttributes = $props();
</script>

<button type="button" class="button {variant}" {...rest}>{@render children()}</button>

<style>
	.button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		min-height: 52px;
		padding: 0 var(--space-4);
		border-radius: var(--radius-control);
		font-size: var(--text-button-size);
		line-height: var(--text-button-line);
		font-weight: var(--text-button-weight);
		transition:
			background-color var(--dur-state) var(--ease),
			border-color var(--dur-state) var(--ease),
			color var(--dur-state) var(--ease);
	}

	.primary {
		background: var(--color-action-primary);
		color: var(--color-action-on-primary);
	}

	.primary:active:not(:disabled) {
		background: var(--color-action-primary-pressed);
	}

	.secondary {
		background: var(--color-surface-hover);
		border: 1px solid var(--color-border-default);
		color: var(--color-text-primary);
	}

	.secondary:active:not(:disabled) {
		background: var(--neutral-twilight);
		border-color: var(--color-border-strong);
	}

	.button:disabled {
		background: var(--color-surface-hover);
		border-color: transparent;
		color: var(--color-text-secondary);
		cursor: default;
	}
</style>
