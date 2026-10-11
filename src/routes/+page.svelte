<script lang="ts">
	import { onMount } from 'svelte';
	import DeckCard from '$lib/components/DeckCard.svelte';
	import { APP_NAME } from '$lib/config';
	import { getRepository } from '$lib/storage';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let flagCount = $state(0);

	onMount(() => {
		flagCount = getRepository().flags().length;
	});
</script>

<svelte:head>
	<title>{APP_NAME}</title>
</svelte:head>

<main class="page">
	<header>
		<h1>{APP_NAME}</h1>
		<p>Every wrong answer gets a follow-up that checks why it was wrong.</p>
	</header>

	<section class="decks" aria-label="Decks">
		{#each data.decks as deck (deck.id)}
			<DeckCard {...deck} />
		{/each}
	</section>

	{#if flagCount > 0}
		<p class="flagged">
			<a href="/flags">{flagCount} flagged {flagCount === 1 ? 'question' : 'questions'}</a>
		</p>
	{/if}
</main>

<style>
	header {
		margin-bottom: 28px;
		text-align: center;
	}

	h1 {
		font-size: 30px;
		font-weight: 800;
		line-height: 1.15;
	}

	header p {
		margin-top: 8px;
		color: var(--text-muted);
	}

	.decks {
		display: grid;
		gap: 15.5px;
	}

	.flagged {
		margin-top: 28px;
		text-align: center;
	}
</style>
