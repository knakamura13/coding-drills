<script lang="ts">
	import Button from './Button.svelte';

	interface Props {
		id: string;
		title: string;
		description: string;
		count: number;
	}

	let { id, title, description, count }: Props = $props();
</script>

<article class="deck" aria-labelledby="deck-{id}">
	<p class="kicker">{count} {count === 1 ? 'question' : 'questions'}</p>
	<h2 id="deck-{id}">{title}</h2>
	<p class="description">{description}</p>
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

	.start {
		margin-top: 16.2px;
	}
</style>
