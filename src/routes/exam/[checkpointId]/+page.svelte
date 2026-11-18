<script lang="ts">
	import Lesson from '$lib/components/Lesson.svelte';
	import { APP_NAME } from '$lib/config';
	import { PASS_RULE } from '$lib/domain/exam';
	import { createReviewLesson } from '$lib/domain/lesson';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const source = { create: (rng: () => number) => createReviewLesson(data.entries, rng) };
</script>

<svelte:head>
	<title>Checkpoint: {data.title} · {APP_NAME}</title>
</svelte:head>

<Lesson {source} title="Checkpoint: {data.title}" subtitle={PASS_RULE} />
