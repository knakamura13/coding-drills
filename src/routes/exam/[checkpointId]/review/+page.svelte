<script lang="ts">
	import { resolve } from '$app/paths';
	import Lesson from '$lib/components/Lesson.svelte';
	import { APP_NAME } from '$lib/config';
	import { createReviewLesson } from '$lib/domain/lesson';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const source = { create: (rng: () => number) => createReviewLesson(data.entries, rng) };
	const subtitle = $derived(
		data.skillTitles.length > 0
			? `Back to ${data.skillTitles.join(', ')}, the skills the checkpoint found shaky.`
			: 'Back to the skills this checkpoint covers.'
	);
</script>

<svelte:head>
	<title>Review for {data.title} · {APP_NAME}</title>
</svelte:head>

<Lesson {source} title="Review for the checkpoint: {data.title}" {subtitle} summaryExtra={again} />

{#snippet again()}
	<p class="again">
		Ready? <a href={resolve('/exam/[checkpointId]', { checkpointId: data.checkpointId })}>Sit the exam again</a>. Only the first try at each question each day counts, so a retake can pass from tomorrow.
	</p>
{/snippet}

<style>
	.again {
		margin-top: 12px;
		line-height: 1.45;
	}

	.again a {
		font-weight: 800;
	}
</style>
