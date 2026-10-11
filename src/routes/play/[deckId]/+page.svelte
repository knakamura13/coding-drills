<script lang="ts">
	import Lesson from '$lib/components/Lesson.svelte';
	import { APP_NAME } from '$lib/config';
	import { createLesson } from '$lib/domain/lesson';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const source = $derived({ create: (rng: () => number) => createLesson(data.deck, rng) });
</script>

<svelte:head>
	<title>{data.deck.title} · {APP_NAME}</title>
</svelte:head>

{#key data.deck.id}
	<Lesson {source} />
{/key}
