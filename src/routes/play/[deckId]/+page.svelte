<script lang="ts">
	import { APP_NAME } from '$lib/config';
	import { curriculum } from 'virtual:curriculum';
	import { answeredIn, createLesson, opensWorkedExample, type LessonView } from '$lib/domain/lesson';
	import { lessonTrail } from '$lib/domain/trail';
	import { getRepository } from '$lib/storage';
	import LessonScreen from '$lib/ui/LessonScreen.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const answered = () => answeredIn(getRepository().attempts(), data.deck.id);
	const source = $derived.by(() => {
		let plannedWith = new Set<string>();
		return {
			create: (rng: () => number) => createLesson(data.deck, rng, (plannedWith = answered())),
			// Attempts are only ever added, so a larger set means new answers.
			outdated: () => answered().size !== plannedWith.size
		};
	});
	const trail = () => lessonTrail(curriculum, getRepository().attempts(), data.deck.id, data.deck.title, data.level);
	const opensExample = (screen: LessonView | null) => opensWorkedExample(screen, getRepository().attempts(), data.deck.id);
</script>

<svelte:head>
	<title>{data.deck.title} · {APP_NAME}</title>
</svelte:head>

{#key data.deck.id}
	<LessonScreen title={data.deck.title} branch={data.branch} {source} {trail} {opensExample} />
{/key}
