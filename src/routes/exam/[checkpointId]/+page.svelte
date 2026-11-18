<script lang="ts">
	import { resolve } from '$app/paths';
	import Lesson from '$lib/components/Lesson.svelte';
	import { APP_NAME } from '$lib/config';
	import { PASS_RULE, examPassed } from '$lib/domain/exam';
	import { createReviewLesson, type Summary } from '$lib/domain/lesson';
	import { skillsChecked } from '$lib/domain/mastery';
	import { getRepository } from '$lib/storage';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const source = { create: (rng: () => number) => createReviewLesson(data.entries, rng) };

	/** What the sitting means: passed, or which skills to review first. Read after the last answer is saved. */
	function result(summary: Summary) {
		const passed = examPassed(data.pool, data.mix, getRepository().attempts());
		const missedIds = new Set(summary.missed.map((miss) => miss.questionId));
		const checked = skillsChecked(data.pool.filter((drill) => missedIds.has(drill.questionId)));
		const reviewHref = `${resolve('/exam/[checkpointId]/review', { checkpointId: data.checkpointId })}${
			checked.length > 0 ? `?skills=${checked.join(',')}` : ''
		}`;
		return { passed, skills: checked.map((id) => data.skillTitles[id] ?? id), reviewHref };
	}
</script>

<svelte:head>
	<title>Checkpoint: {data.title} · {APP_NAME}</title>
</svelte:head>

<Lesson {source} title="Checkpoint: {data.title}" subtitle={PASS_RULE} summaryExtra={outcome} />

{#snippet outcome(summary: Summary)}
	{@const verdict = result(summary)}
	<section class="outcome" aria-labelledby="outcome-heading">
		{#if verdict.passed}
			<h2 id="outcome-heading">Checkpoint passed</h2>
			<p>The next skills are open in the <a href={resolve('/tree')}>mastery tree</a>.</p>
		{:else}
			<h2 id="outcome-heading">Not passed yet</h2>
			<p>
				{#if verdict.skills.length > 0}
					Review {verdict.skills.join(', ')} first.
				{:else}
					Review the skills on this path first.
				{/if}
				Only the first try at each question each day counts, so sit the exam again on another day.
			</p>
			<p><a class="review-link" href={verdict.reviewHref}>Review these skills</a></p>
		{/if}
	</section>
{/snippet}

<style>
	.outcome {
		margin-top: 16px;
		padding: 14px 16px;
		border: 2px solid var(--line);
		border-radius: 12px;
		text-align: left;
	}

	.outcome h2 {
		font-size: 18px;
		font-weight: 800;
	}

	.outcome p {
		margin-top: 6px;
		line-height: 1.45;
	}

	.review-link {
		font-weight: 800;
	}
</style>
