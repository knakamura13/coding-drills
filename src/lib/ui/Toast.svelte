<!--
	The toast for `toast()` from toast.svelte.ts. Mount it once (the root layout does). The live region
	stays in the DOM so every message is announced.
-->
<script lang="ts">
	import { toastState } from './toast.svelte';
</script>

<div class="toast" class:show={toastState.visible} role="status" aria-live="polite">{toastState.message}</div>

<style>
	.toast {
		position: fixed;
		left: 50%;
		top: calc(env(safe-area-inset-top) + 64px);
		z-index: 10;
		max-width: calc(100% - 40px);
		padding: 11px 16px;
		border-radius: var(--radius-m);
		background: rgba(16, 24, 42, 0.94);
		border: 1px solid rgba(246, 200, 96, 0.35);
		box-shadow: var(--shadow-float);
		font-size: 13.5px;
		font-weight: 550;
		text-align: center;
		opacity: 0;
		pointer-events: none;
		transform: translate(-50%, -14px) scale(0.96);
		transition:
			opacity calc(300ms * var(--motion)),
			transform calc(500ms * var(--motion)) var(--ease-spring);
	}

	.show {
		opacity: 1;
		transform: translate(-50%, 0) scale(1);
	}
</style>
