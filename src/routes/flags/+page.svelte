<script lang="ts">
	import { onMount } from 'svelte';
	import FlagList from '$lib/components/FlagList.svelte';
	import { APP_NAME } from '$lib/config';
	import { getRepository, type Flag } from '$lib/storage';
	import { initSync, syncSoon } from '$lib/sync/store.svelte';

	let flags = $state<Flag[]>([]);

	onMount(() => {
		flags = getRepository().flags();
		void initSync();
	});

	function remove(id: string) {
		const repository = getRepository();
		repository.removeFlag(id);
		flags = repository.flags();
		syncSoon();
	}
</script>

<svelte:head>
	<title>Flagged questions · {APP_NAME}</title>
</svelte:head>

<main class="page">
	<a class="back" href="/">← Decks</a>
	<h1>Flagged questions</h1>
	<p class="lede">
		Saved on this device, and synced when you are signed in. Each flag can be opened as an issue on the public GitHub repo.
	</p>

	{#if flags.length === 0}
		<p class="empty">Nothing flagged.</p>
	{:else}
		<FlagList {flags} onremove={remove} />
	{/if}
</main>

<style>
	.back {
		display: inline-block;
		margin-bottom: 18px;
		font-weight: 700;
		text-decoration: none;
	}

	h1 {
		font-size: 28px;
		font-weight: 800;
		line-height: 1.2;
	}

	.lede {
		margin: 8px 0 24px;
		color: var(--text-muted);
	}

	.empty {
		color: var(--text-muted);
	}
</style>
