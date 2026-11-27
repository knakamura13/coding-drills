<script lang="ts">
	import { curriculum } from 'virtual:curriculum';
	import { decks } from 'virtual:deck-index';
	import MasteryTree from '$lib/components/MasteryTree.svelte';
	import { APP_NAME } from '$lib/config';
	import { DEFAULT_LEVEL } from '$lib/content/depth';
	import { localDay } from '$lib/domain/days';
	import { projectCurriculum } from '$lib/domain/mastery';
	import { learnerDepth } from '$lib/preferences/store.svelte';
	import { getRepository, type Attempt } from '$lib/storage';
	import { account } from '$lib/sync/store.svelte';

	let attempts = $state<Attempt[]>([]);
	let ready = $state(false);
	// Prerendered at the default level; the learner's level is read on the device (#155).
	let level = $state(DEFAULT_LEVEL);

	// The map itself is static. Progress is read on the device, and again when a sync arrives.
	$effect(() => {
		void account.version;
		attempts = getRepository().attempts();
		level = learnerDepth();
		ready = true;
	});

	const deckTitles = new Map(decks.map((deck) => [deck.id, deck.title]));
	const tree = $derived(projectCurriculum(curriculum, ready ? attempts : [], level, deckTitles, localDay(new Date())));
</script>

<svelte:head>
	<title>Mastery tree · {APP_NAME}</title>
</svelte:head>

<MasteryTree {tree} {ready} />
