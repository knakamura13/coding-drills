<script lang="ts">
	import { APP_NAME } from '$lib/config';
	import { createLesson } from '$lib/domain/lesson';
	import LessonScreen from '$lib/ui/LessonScreen.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const source = $derived({ create: (rng: () => number) => createLesson(data.deck, rng) });
</script>

<svelte:head>
	<title>{data.deck.title} · {APP_NAME}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#key data.deck.id}
	<LessonScreen title={data.deck.title} branch={data.branch} {source} />
{/key}
