<script lang="ts">
	import { onMount } from 'svelte';
	import FlagList from '$lib/components/FlagList.svelte';
	import { APP_NAME } from '$lib/config';
	import { refreshStatus } from '$lib/nav/status.svelte';
	import { getRepository, type Flag } from '$lib/storage';
	import { syncSoon } from '$lib/sync/store.svelte';

	let flags = $state<Flag[]>([]);

	onMount(() => {
		flags = getRepository().flags();
	});

	function remove(id: string) {
		const repository = getRepository();
		repository.removeFlag(id);
		flags = repository.flags();
		// The count in the menu follows the list.
		refreshStatus();
		syncSoon();
	}
</script>

<svelte:head>
	<title>Flagged questions · {APP_NAME}</title>
</svelte:head>

<main class="page wide">
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
