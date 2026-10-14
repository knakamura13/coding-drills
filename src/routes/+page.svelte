<script lang="ts">
	import { onMount } from 'svelte';
	import ActionCard from '$lib/components/ActionCard.svelte';
	import AuthNotice from '$lib/components/AuthNotice.svelte';
	import PracticeCard from '$lib/components/PracticeCard.svelte';
	import ReviewCard from '$lib/components/ReviewCard.svelte';
	import { APP_NAME } from '$lib/config';
	import { status } from '$lib/nav/status.svelte';
	import { REVIEW_SIZE } from '$lib/review/queue';
	import { WEAK_SIZE } from '$lib/review/weak';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let notice = $state('');

	onMount(() => {
		notice = new URLSearchParams(location.search).get('auth') ?? '';
		// The message is shown once. Keep the URL clean so a reload or a shared link does not repeat it.
		if (notice) history.replaceState(history.state, '', location.pathname);
	});

	const snap = $derived(status.snapshot);
	const next = $derived(snap.suggested);
	const nextStat = $derived(next ? snap.progress.get(next.id) : undefined);
	const nextPercent = $derived(nextStat && next ? Math.round((nextStat.learned / next.questions.length) * 100) : 0);
	const weakTaking = $derived(Math.min(snap.weak, WEAK_SIZE));
</script>

<svelte:head>
	<title>{APP_NAME}</title>
</svelte:head>

<main class="page wide home">
	<header class="intro">
		<h1>{APP_NAME}</h1>
		<p>Every wrong answer gets a follow-up that checks why it was wrong.</p>
		<!-- The line is always there, so the cards below do not move when a streak appears. -->
		<p class="streak-line">
			{#if snap.streak >= 2}
				<span class="streak">{snap.streak} day streak</span>
			{/if}
		</p>
	</header>

	<AuthNotice {notice} />

	<div class="cards">
		<!-- Each slot holds its height before the stored progress arrives, so nothing below it moves. -->
		<div class="slot review-slot">
			{#if snap.ready}
				<ReviewCard
					dueCount={snap.review?.dueCount ?? 0}
					sitting={REVIEW_SIZE}
					nextInDays={snap.review?.nextInDays ?? null}
				/>
			{/if}
		</div>

		<div class="slot next-slot">
			{#if snap.ready && next}
				<ActionCard
					id="next"
					kicker="Next up"
					title={next.title}
					description={next.description}
					href="/play/{next.id}"
					action="Start {next.title}"
				>
					{#if nextStat}
						<div class="meter" aria-hidden="true"><span style:width="{nextPercent}%"></span></div>
						<p class="learned">
							{nextStat.learned} of {next.questions.length} learned{nextStat.due > 0 ? ` · ${nextStat.due} due` : ''}
						</p>
					{/if}
				</ActionCard>
			{/if}
		</div>

		<div class="full">
			<PracticeCard topics={data.topics} total={data.totalQuestions} />
		</div>

		<!-- Appended below the practice card, so when it appears nothing above it moves. -->
		{#if snap.weak > 0}
			<ActionCard
				id="weak"
				kicker="Weak spots"
				title="{snap.weak} {snap.weak === 1 ? 'question' : 'questions'} you have missed"
				description="Practice the ones you fail most often, whether or not they are due."
				href="/weak"
				action="Drill {weakTaking} weak {weakTaking === 1 ? 'spot' : 'spots'}"
			/>
		{/if}
	</div>

	<p class="browse"><a href="/decks">Browse all {data.deckCount} decks</a></p>
</main>

<style>
	.intro {
		margin-bottom: 16px;
		text-align: center;
	}

	h1 {
		font-size: 30px;
		font-weight: 800;
		line-height: 1.15;
	}

	.intro p {
		margin-top: 8px;
		color: var(--text-muted);
	}

	.streak-line {
		min-height: 32px;
		margin-top: 8px;
	}

	.streak {
		display: inline-block;
		margin-top: 4px;
		padding: 3px 12px;
		border-radius: 999px;
		background: var(--accent-soft);
		color: var(--accent-glow);
		font-size: 13px;
		font-weight: 800;
	}

	.cards {
		display: grid;
		gap: 15.5px;
	}

	/* A slot is a flex column whose one child fills it, so a card that is a little shorter
	   than its slot leaves no gap, and a card that is a little taller does not push content. */
	.slot {
		display: flex;
		flex-direction: column;
	}

	.slot > :global(*) {
		flex: 1;
	}

	.review-slot {
		min-height: 204px;
	}

	.next-slot {
		min-height: 252px;
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
		font-size: 13px;
		line-height: 18px;
	}

	.browse {
		margin-top: 20px;
		text-align: center;
	}

	.browse a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		font-weight: 700;
	}

	@media (prefers-reduced-motion: reduce) {
		.meter span {
			transition: none;
		}
	}

	/* Two columns on a tablet or desktop: review beside the next deck, practice beside weak spots. */
	@media (min-width: 720px) {
		.cards {
			grid-template-columns: 1fr 1fr;
			align-items: stretch;
		}

		/* Practice spans both columns, so the row under the two cards has no empty cell. */
		.full {
			grid-column: 1 / -1;
		}
	}
</style>
