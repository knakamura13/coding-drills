<script lang="ts">
	import Lesson from '$lib/components/Lesson.svelte';
	import { APP_NAME } from '$lib/config';
	import { createReviewLesson } from '$lib/domain/lesson';
	import { tagLabel } from '$lib/review/practice';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// The draw is fixed when the page loads, so retrying replays the same questions.
	const source = { create: (rng: () => number) => createReviewLesson(data.entries, rng) };

	const subtitle = $derived(
		data.tag
			? `Random questions on ${tagLabel(data.tag)}. Nothing needs to be due.`
			: 'Random questions from every deck. Nothing needs to be due.'
	);
</script>

<svelte:head>
	<title>Practice · {APP_NAME}</title>
</svelte:head>

<Lesson {source} title="Mixed practice" {subtitle} />
