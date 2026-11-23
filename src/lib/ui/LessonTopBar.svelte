<!--
	The lesson top bar (lesson Rounds 1 and 6): quit at left, the title centered in Mist, and one
	progress segment per question below. The summary passes no `total`, so it shows only its title.
-->
<script lang="ts">
	import Icon from './Icon.svelte';
	import ProgressSegments from './ProgressSegments.svelte';

	let {
		title,
		total,
		done = 0,
		onquit,
		quitLabel = 'Quit lesson'
	}: { title: string; total?: number; done?: number; onquit: () => void; quitLabel?: string } = $props();
</script>

<header class="bar">
	<div class="row">
		<button type="button" class="quit" aria-label={quitLabel} onclick={onquit}><Icon name="close" /></button>
		<p class="title">{title}</p>
		<span class="balance" aria-hidden="true"></span>
	</div>
	{#if total}
		<ProgressSegments {total} {done} />
	{/if}
</header>

<style>
	.bar {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.row {
		display: grid;
		grid-template-columns: 48px 1fr 48px;
		align-items: center;
		height: 24px;
	}

	/* A 44px touch target around the 24px icon, aligned to the screen edge. */
	.quit {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		margin: -10px 0 -10px -10px;
		border-radius: var(--radius-control);
	}

	.title {
		text-align: center;
		color: var(--color-text-secondary);
		font-size: var(--text-label-size);
		line-height: var(--text-label-line);
		font-weight: var(--text-label-weight);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
