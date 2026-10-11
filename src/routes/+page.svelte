<script lang="ts">
	import { onMount } from 'svelte';
	import AccountRow from '$lib/components/AccountRow.svelte';
	import DeckCard from '$lib/components/DeckCard.svelte';
	import ReviewCard from '$lib/components/ReviewCard.svelte';
	import { APP_NAME } from '$lib/config';
	import { localDay } from '$lib/domain/days';
	import { streak } from '$lib/domain/streak';
	import { REVIEW_SIZE, deckProgress, reviewStatus, type DeckProgress, type ReviewStatus } from '$lib/review/queue';
	import { getRepository } from '$lib/storage';
	import { account, initSync } from '$lib/sync/store.svelte';
	import { decks } from 'virtual:decks';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let flagCount = $state(0);
	let review = $state<ReviewStatus | null>(null);
	let notice = $state('');
	let progress = $state<Map<string, DeckProgress>>(new Map());
	let streakDays = $state(0);

	/** Reads local data again. Runs on load and whenever a sync brings something new. */
	function refresh() {
		const repository = getRepository();
		flagCount = repository.flags().length;
		const attempts = repository.attempts();
		const today = localDay(new Date());
		progress = deckProgress(decks, attempts, today);
		streakDays = streak(
			attempts.map((attempt) => attempt.day),
			today
		);
		const status = reviewStatus(decks, attempts, today);
		// Nothing scheduled yet: the card would only say "Nothing due" before any deck was played.
		review = status.dueCount > 0 || status.nextInDays !== null ? status : null;
	}

	onMount(() => {
		notice = new URLSearchParams(location.search).get('auth') ?? '';
		void initSync();
	});

	$effect(() => {
		void account.version;
		refresh();
	});
</script>

<svelte:head>
	<title>{APP_NAME}</title>
</svelte:head>

<main class="page">
	<header>
		<h1>{APP_NAME}</h1>
		<p>Every wrong answer gets a follow-up that checks why it was wrong.</p>
		{#if streakDays >= 2}
			<p class="streak">{streakDays} day streak</p>
		{/if}
	</header>

	{#if review}
		<div class="review"><ReviewCard dueCount={review.dueCount} sitting={REVIEW_SIZE} nextInDays={review.nextInDays} /></div>
	{/if}

	<section class="decks" aria-label="Decks">
		{#each data.decks as deck (deck.id)}
			<DeckCard {...deck} progress={progress.get(deck.id)} />
		{/each}
	</section>

	{#if flagCount > 0}
		<p class="flagged">
			<a href="/flags">{flagCount} flagged {flagCount === 1 ? 'question' : 'questions'}</a>
		</p>
	{/if}

	<footer><AccountRow {notice} /></footer>
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

	.streak {
		display: inline-block;
		margin-top: 12px;
		padding: 3px 12px;
		border-radius: 999px;
		background: var(--accent-soft);
		color: var(--accent-glow);
		font-size: 13px;
		font-weight: 800;
	}

	.review {
		margin-bottom: 15.5px;
	}

	footer {
		margin-top: 28px;
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
