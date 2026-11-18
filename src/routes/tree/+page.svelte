<script lang="ts">
	import { curriculum } from 'virtual:curriculum';
	import { decks } from 'virtual:deck-index';
	import MasteryTree from '$lib/components/MasteryTree.svelte';
	import { APP_NAME } from '$lib/config';
	import { projectCurriculum } from '$lib/domain/mastery';
	import { getRepository, type Attempt } from '$lib/storage';
	import { account } from '$lib/sync/store.svelte';

	let attempts = $state<Attempt[]>([]);
	let ready = $state(false);

	// The map itself is static. Progress is read on the device, and again when a sync arrives.
	$effect(() => {
		void account.version;
		attempts = getRepository().attempts();
		ready = true;
	});

	const deckTitles = new Map(decks.map((deck) => [deck.id, deck.title]));
	const tree = $derived(projectCurriculum(curriculum, ready ? attempts : [], deckTitles));
</script>

<svelte:head>
	<title>Mastery tree · {APP_NAME}</title>
</svelte:head>

<MasteryTree {tree} {ready} />
