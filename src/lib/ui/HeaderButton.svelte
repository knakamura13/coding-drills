<script lang="ts">
	import type { Snippet } from 'svelte';
	let { label, onclick, children }: { label: string; onclick: () => void; children: Snippet } = $props();
</script>

<button type="button" aria-label={label} {onclick}>{@render children()}</button>

<style>
	button {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		flex: none;
		padding: 0;
		border: 1px solid var(--color-border-default);
		border-radius: 8px;
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
		cursor: pointer;
	}
</style>
