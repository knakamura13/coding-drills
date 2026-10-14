<script lang="ts">
	import Lesson from '$lib/components/Lesson.svelte';
	import { APP_NAME } from '$lib/config';
	import { createReviewLesson } from '$lib/domain/lesson';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// The sitting is fixed when the page loads, so retrying replays the same questions.
	const source = { create: (rng: () => number) => createReviewLesson(data.entries, rng) };
</script>

<svelte:head>
	<title>Review · {APP_NAME}</title>
</svelte:head>

<Lesson
	{source}
	title="Review"
	subtitle="Questions due today, most overdue first. Each answer sets when you see it next."
/>
