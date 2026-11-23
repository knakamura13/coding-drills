<!--
	The footer strip pinned to the bottom of a lesson (lesson Round 1): Midnight with a Twilight top
	edge; content scrolls under it. Holds the one primary action, or Done and Retry on the summary.
	On desktop the buttons stay in the 640px content column.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<footer class="footer">
	<div class="actions">{@render children()}</div>
</footer>

<style>
	.footer {
		position: sticky;
		bottom: 0;
		z-index: 1;
		border-top: 1px solid var(--color-border-default);
		background: var(--color-surface-page);
		padding: var(--space-4) var(--space-screen-edge) max(var(--space-4), env(safe-area-inset-bottom));
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		max-width: 640px;
		margin: 0 auto;
	}
</style>
