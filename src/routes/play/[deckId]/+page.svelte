<script lang="ts">
	import { APP_NAME } from '$lib/config';
	import { curriculum } from 'virtual:curriculum';
	import { createLesson, opensWorkedExample, type LessonView } from '$lib/domain/lesson';
	import { lessonTrail } from '$lib/domain/trail';
	import { getRepository } from '$lib/storage';
	import LessonScreen from '$lib/ui/LessonScreen.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const source = $derived({ create: (rng: () => number) => createLesson(data.deck, rng) });
	const trail = () => lessonTrail(curriculum, getRepository().attempts(), data.deck.id, data.deck.title);
	const opensExample = (screen: LessonView | null) => opensWorkedExample(screen, getRepository().attempts(), data.deck.id);
</script>

<svelte:head>
	<title>{data.deck.title} · {APP_NAME}</title>
</svelte:head>

{#key data.deck.id}
	<LessonScreen title={data.deck.title} branch={data.branch} {source} {trail} {opensExample} />
{/key}
