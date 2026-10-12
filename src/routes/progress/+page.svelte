<script lang="ts">
	import { onMount } from 'svelte';
	import Calendar from '$lib/components/Calendar.svelte';
	import { APP_NAME } from '$lib/config';
	import { localDay } from '$lib/domain/days';
	import { activity, calendar, topicStats, totals, type DayCell, type TopicStat, type Totals } from '$lib/domain/stats';
	import { streak } from '$lib/domain/streak';
	import { deckProgress, type DeckProgress } from '$lib/review/queue';
	import { tagLabel } from '$lib/review/practice';
	import { getRepository } from '$lib/storage';
	import { account, initSync } from '$lib/sync/store.svelte';
	import { decks } from 'virtual:decks';

	const WEEKS = 12;

	let ready = $state(false);
	let weeks = $state<(DayCell | null)[][]>([]);
	let summary = $state<Totals>({ answered: 0, correct: 0, daysPracticed: 0 });
	let streakDays = $state(0);
	let activeDays = $state(0);
	let topics = $state<TopicStat[]>([]);
	let byDeck = $state<Map<string, DeckProgress>>(new Map());

	function load() {
		const attempts = getRepository().attempts();
		const today = localDay(new Date());
		const counts = activity(attempts);
		weeks = calendar(counts, today, WEEKS);
		activeDays = weeks.flat().filter((cell) => cell !== null && cell.count > 0).length;
		summary = totals(attempts);
		streakDays = streak(counts.keys(), today);
		topics = topicStats(decks, attempts);
		byDeck = deckProgress(decks, attempts, today);
		ready = true;
	}

	onMount(() => void initSync());

	// Runs on load, and again whenever a sync brings another device's answers.
	$effect(() => {
		void account.version;
		load();
	});

	const accuracy = $derived(summary.answered === 0 ? null : Math.round((summary.correct / summary.answered) * 100));
	const percent = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100));
</script>

<svelte:head>
	<title>Progress · {APP_NAME}</title>
</svelte:head>

<main class="page">
	<a class="back" href="/">← Decks</a>
	<h1>Progress</h1>

	{#if ready && summary.answered === 0}
		<p class="empty">Nothing to show yet. Answer a few questions and your history will appear here.</p>
	{:else if ready}
		<section class="stats" aria-label="Totals">
			<div class="stat"><span class="value">{streakDays}</span><span class="label">day streak</span></div>
			<div class="stat"><span class="value">{summary.daysPracticed}</span><span class="label">days practiced</span></div>
			<div class="stat">
				<span class="value">{accuracy === null ? '–' : `${accuracy}%`}</span>
				<span class="label">right first try</span>
			</div>
		</section>

		<section aria-labelledby="calendar-heading">
			<h2 id="calendar-heading">Last {WEEKS} weeks</h2>
			<Calendar
				{weeks}
				summary="Practice calendar: you practiced on {activeDays} of the last {WEEKS * 7} days."
			/>
		</section>

		{#if topics.length > 0}
			<section aria-labelledby="topics-heading">
				<h2 id="topics-heading">Topics</h2>
				<ul class="rows">
					{#each topics as topic (topic.tag)}
						<li class="row">
							<div class="line">
								<span class="name">{tagLabel(topic.tag)}</span>
								<span class="detail">
									{topic.learned} of {topic.questions} learned{topic.answered > 0
										? ` · ${percent(topic.correct, topic.answered)}% right`
										: ''}
								</span>
							</div>
							<div class="meter" aria-hidden="true"><span style:width="{percent(topic.learned, topic.questions)}%"></span></div>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<section aria-labelledby="decks-heading">
			<h2 id="decks-heading">Decks</h2>
			<ul class="rows">
				{#each decks as deck (deck.id)}
					{@const stat = byDeck.get(deck.id)}
					<li class="row">
						<div class="line">
							<span class="name">{deck.title}</span>
							<span class="detail">{stat?.learned ?? 0} of {deck.questions.length} learned</span>
						</div>
						<div class="meter" aria-hidden="true">
							<span style:width="{percent(stat?.learned ?? 0, deck.questions.length)}%"></span>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</main>

<style>
	.back {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		font-weight: 700;
		text-decoration: none;
	}

	h1 {
		font-size: 28px;
		font-weight: 800;
		line-height: 1.2;
	}

	h2 {
		margin: 32px 0 12px;
		color: var(--text-muted);
		font-size: 13px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.empty {
		margin-top: 12px;
		color: var(--text-muted);
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
		margin-top: 20px;
	}

	.stat {
		display: grid;
		align-content: start;
		gap: 2px;
		padding: 14px 10px;
		border: 2px solid var(--line);
		border-radius: 16px;
		text-align: center;
	}

	.value {
		font-size: 24px;
		font-weight: 800;
		line-height: 1.1;
	}

	.label {
		color: var(--text-muted);
		font-size: 12px;
	}

	.rows {
		display: grid;
		gap: 14px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.line {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 2px 12px;
	}

	.name {
		font-weight: 700;
	}

	.detail {
		color: var(--text-muted);
		font-size: 13px;
	}

	.meter {
		height: 6px;
		margin-top: 8px;
		overflow: hidden;
		border-radius: 3px;
		background: var(--line);
	}

	.meter span {
		display: block;
		height: 100%;
		border-radius: 3px;
		background: var(--right-btn);
	}
</style>
