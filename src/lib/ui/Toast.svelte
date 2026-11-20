<!--
	The toast for `toast()` from toast.svelte.ts. Mount it once (the root layout does). The live region
	stays in the DOM so every message is announced.
-->
<script lang="ts">
	import { toastState } from './toastState.svelte';
</script>

<div class="toast" class:show={toastState.visible} role="status" aria-live="polite">{toastState.message}</div>

<style>
	.toast {
		position: fixed;
		left: 50%;
		top: calc(env(safe-area-inset-top) + 64px);
		z-index: 10;
		max-width: calc(100% - 2 * var(--space-screen-edge));
		padding: 10px var(--space-3);
		border-radius: var(--radius-card);
		background: var(--color-surface-card);
		border: 1px solid var(--accent-border);
		/* One of the two places glow is allowed (the other is celebrations). */
		box-shadow: 0 0 32px var(--accent-soft-glow);
		font-size: var(--text-label-size);
		line-height: var(--text-label-line);
		font-weight: var(--text-label-weight);
		text-align: center;
		opacity: 0;
		pointer-events: none;
		/* Drops in from above; with Reduce effects --shift is 0, so it only fades. */
		transform: translate(-50%, calc(-1 * var(--toast-distance) * var(--shift)));
		transition:
			opacity var(--dur-toast-out) var(--ease),
			transform var(--dur-toast-out) var(--ease);
	}

	.show {
		opacity: 1;
		transform: translate(-50%, 0);
		transition-duration: var(--dur-toast-in);
	}
</style>
