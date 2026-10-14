<script lang="ts">
	import { APP_NAME } from '$lib/config';
	import { status } from '$lib/nav/status.svelte';
	import { filterDecks } from '$lib/review/decks';
	import { shortcuts } from '$lib/settings/shortcuts.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let query = $state('');
	let search: HTMLInputElement | undefined = $state();

	const shown = $derived(filterDecks(data.decks, query));
	const questionCount = $derived(data.decks.reduce((sum, deck) => sum + deck.count, 0));

	function percent(part: number, whole: number) {
		return whole === 0 ? 0 : Math.round((part / whole) * 100);
	}

	/** "/" moves to the filter. It is a single-key shortcut, so the menu can switch it off. */
	function onkeydown(event: KeyboardEvent) {
		if (!shortcuts.enabled || event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
		const target = event.target instanceof HTMLElement ? event.target : null;
		if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
		event.preventDefault();
		search?.focus();
	}
</script>

<svelte:head>
	<title>Decks · {APP_NAME}</title>
</svelte:head>

<svelte:window {onkeydown} />

<main class="page wide">
	<h1>Decks</h1>
	<p class="lede">{data.decks.length} decks, {questionCount} questions.</p>

	<div class="search">
		<label for="deck-filter" class="sr-only">Filter decks</label>
		<input
			id="deck-filter"
			type="search"
			placeholder="Filter decks"
			autocomplete="off"
			bind:value={query}
			bind:this={search}
		/>
	</div>

	{#if shown.length === 0}
		<p class="empty">No decks match “{query}”.</p>
	{:else}
		<ul class="decks">
			{#each shown as deck (deck.id)}
				{@const stat = status.snapshot.progress.get(deck.id)}
				{@const learned = stat?.learned ?? 0}
				<li>
					<!-- The whole row starts the deck: one tap, and the name is the link text. -->
					<a class="row" href="/play/{deck.id}">
						<span class="head">
							<span class="name">{deck.title}</span>
							{#if stat && stat.due > 0}
								<span class="due">{stat.due} due</span>
							{/if}
						</span>
						<span class="description">{deck.description}</span>
						<span class="meter" aria-hidden="true"><span style:width="{percent(learned, deck.count)}%"></span></span>
						<span class="meta">{learned} of {deck.count} learned</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	h1 {
		font-size: 28px;
		font-weight: 800;
		line-height: 1.2;
	}

	.lede {
		margin-top: 8px;
		color: var(--text-muted);
	}

	.search {
		margin-top: 18px;
	}

	.search input {
		display: block;
		width: 100%;
		min-height: 44px;
		padding: 0 14px;
		/* The field's edge must reach 3:1 against the page (WCAG 1.4.11), so it is not the faint card line. */
		border: 2px solid var(--text-faint);
		border-radius: 12px;
		background: var(--bg);
		color: var(--text);
		font: inherit;
		font-size: 16px;
	}

	.search input::placeholder {
		color: var(--text-muted);
	}

	.empty {
		margin-top: 20px;
		color: var(--text-muted);
	}

	.decks {
		display: grid;
		gap: 12px;
		margin: 18px 0 0;
		padding: 0;
		list-style: none;
	}

	.row {
		display: grid;
		gap: 6px;
		padding: 16px 18px;
		border: 2px solid var(--line);
		border-radius: 16px;
		color: var(--text);
		text-decoration: none;
	}

	.row:hover {
		border-color: #5a5a6e;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 2px 12px;
	}

	.name {
		font-size: 17px;
		font-weight: 700;
		line-height: 25px;
	}

	.due {
		color: var(--accent-glow);
		font-size: 13px;
		font-weight: 700;
	}

	.description {
		color: var(--text-muted);
		font-size: 13px;
		line-height: 19.2px;
	}

	.meter {
		height: 6px;
		margin-top: 4px;
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

	.meta {
		color: var(--text-muted);
		font-size: 13px;
	}

	/* Two columns once there is room, so the list is half as long on a tablet. */
	@media (min-width: 640px) {
		.decks {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
