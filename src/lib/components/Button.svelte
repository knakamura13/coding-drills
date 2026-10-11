<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'success' | 'danger' | 'outline';

	interface Props extends HTMLButtonAttributes {
		variant?: Variant;
		/** Renders a link instead of a button. */
		href?: string;
		/** Opens an external link in a new tab. */
		external?: boolean;
		/** The rendered element, for focus management. */
		el?: HTMLElement;
		children: Snippet;
	}

	let { variant = 'primary', href, external = false, el = $bindable(), children, ...rest }: Props = $props();
</script>

{#if href}
	<a
		bind:this={el}
		class="btn {variant}"
		{href}
		target={external ? '_blank' : undefined}
		rel={external ? 'noopener noreferrer' : undefined}>{@render children()}</a
	>
{:else}
	<button bind:this={el} type="button" class="btn {variant}" {...rest}>{@render children()}</button>
{/if}

<style>
	/* The 3D edge is a real bottom border: a 42px face plus a 4px edge, 46px in all. */
	.btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		min-height: 46px;
		padding: 0 20px;
		border: 0;
		border-bottom: 4px solid transparent;
		border-radius: 12px;
		font-size: 15px;
		font-weight: 700;
		letter-spacing: 0.42px;
		line-height: 1.2;
		text-align: center;
		text-decoration: none;
		cursor: pointer;
		transition:
			transform 80ms ease,
			filter 120ms ease;
	}

	.primary {
		background: var(--accent);
		color: var(--on-color);
		border-bottom-color: var(--accent-edge);
	}

	.success {
		background: var(--right-btn);
		color: var(--on-color);
		border-bottom-color: var(--right-edge);
	}

	.danger {
		background: var(--wrong-btn);
		color: var(--on-color);
		border-bottom-color: var(--wrong-edge);
	}

	/* 2px outline all round, 4px at the bottom: 47px in all. */
	.outline {
		min-height: 47px;
		padding-top: 0.4px;
		border: 2px solid var(--line);
		border-bottom-width: 4px;
		background: var(--bg);
		color: var(--text);
	}

	.btn:hover:not(:disabled) {
		filter: brightness(1.06);
	}

	/* Pressing sinks the face onto its edge. The margin keeps the layout from moving. */
	.btn:active:not(:disabled) {
		transform: translateY(4px);
		min-height: 42px;
		margin-bottom: 4px;
		border-bottom-width: 0;
	}

	.outline:active:not(:disabled) {
		transform: translateY(2px);
		min-height: 45px;
		margin-bottom: 2px;
		border-bottom-width: 2px;
	}

	/* Flat, 45px: the reference's inactive Check button has no edge. */
	.btn:disabled {
		min-height: 45px;
		border-bottom-width: 0;
		background: var(--line);
		color: var(--text-faint);
		cursor: not-allowed;
	}
</style>
