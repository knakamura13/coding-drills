<script lang="ts">
	import Button from './Button.svelte';

	interface Props {
		id: string;
		title: string;
		description: string;
		count: number;
		/** Absent until this device has local data to show. */
		progress?: { seen: number; learned: number; due: number };
	}

	let { id, title, description, count, progress }: Props = $props();

	const learnedPercent = $derived(progress ? Math.round((progress.learned / count) * 100) : 0);
</script>

<article class="deck" aria-labelledby="deck-{id}">
	<p class="kicker">
		{count}
		{count === 1 ? 'question' : 'questions'}{#if progress && progress.due > 0}
			· {progress.due} due{/if}
	</p>
	<h2 id="deck-{id}">{title}</h2>
	<p class="description">{description}</p>
	{#if progress && progress.seen > 0}
		<div class="meter" aria-hidden="true"><span style:width="{learnedPercent}%"></span></div>
		<p class="learned">{progress.learned} of {count} learned</p>
	{/if}
	<div class="start"><Button href="/play/{id}">Start</Button></div>
</article>

<style>
	/* 19px of padding inside a 2px border, the same card as the lesson's problem card. */
	.deck {
		padding: 19px;
		border: 2px solid var(--line);
		border-radius: 16px;
	}

	.kicker {
		color: var(--text-muted);
		font-size: 10px;
		font-weight: 700;
		line-height: 15px;
		letter-spacing: 1.5px;
		text-transform: uppercase;
	}

	h2 {
		margin-top: 16.3px;
		font-size: 17px;
		font-weight: 700;
		line-height: 25px;
	}

	.description {
		margin-top: 5px;
		color: var(--text-muted);
		font-size: 13px;
		line-height: 19.2px;
	}

	.meter {
		height: 6px;
		margin-top: 14px;
		overflow: hidden;
		border-radius: 3px;
		background: var(--line);
	}

	.meter span {
		display: block;
		height: 100%;
		border-radius: 3px;
		background: var(--right-btn);
		transition: width 400ms ease;
	}

	.learned {
		margin-top: 6px;
		color: var(--text-muted);
		font-size: 12px;
		line-height: 16px;
	}

	.start {
		margin-top: 16.2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.meter span {
			transition: none;
		}
	}
</style>
