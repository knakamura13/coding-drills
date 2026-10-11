<script lang="ts">
	import Icon from './Icon.svelte';

	let { progress, onclose }: { progress: number; onclose: () => void } = $props();

	const percent = $derived(Math.round(progress * 100));
</script>

<header class="top">
	<button type="button" class="close" aria-label="Quit lesson" onclick={onclose}>
		<Icon name="close" size={24} />
	</button>
	<div
		class="track"
		role="progressbar"
		aria-label="Lesson progress"
		aria-valuemin="0"
		aria-valuemax="100"
		aria-valuenow={percent}
	>
		<div class="fill" style:width="{percent}%"></div>
	</div>
</header>

<style>
	/* A 44px row: the close target is 44px square and the bar is centered on it. */
	.top {
		display: flex;
		align-items: center;
		gap: 8.5px;
		padding: max(24px, calc(env(safe-area-inset-top) + 12px)) 27px 0 8.5px;
	}

	.close {
		display: grid;
		flex: none;
		place-items: center;
		width: 44px;
		height: 44px;
		padding: 0;
		border: 0;
		border-radius: 12px;
		background: none;
		color: var(--text);
		cursor: pointer;
	}

	.track {
		flex: 1;
		height: 15.2px;
		border-radius: 999px;
		background: var(--line);
		overflow: hidden;
	}

	/* The stub at zero progress is 25px wide, as in the reference. */
	.fill {
		position: relative;
		height: 100%;
		min-width: 25px;
		border-radius: 999px;
		background: var(--accent);
		transition: width 350ms cubic-bezier(0.3, 0.7, 0.3, 1);
	}

	/* The lighter stripe near the top edge of the fill. */
	.fill::after {
		content: '';
		position: absolute;
		top: 3.5px;
		left: 6px;
		right: 6px;
		height: 3.2px;
		border-radius: 3px;
		background: var(--accent-glow);
	}
</style>
