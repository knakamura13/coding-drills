<script lang="ts">
	import { PRACTICE_SIZE, tagLabel, type TopicCount } from '$lib/review/practice';
	import ActionCard from './ActionCard.svelte';

	let { topics, total }: { topics: TopicCount[]; total: number } = $props();

	let tag = $state('');

	const href = $derived(tag ? `/practice?tag=${encodeURIComponent(tag)}` : '/practice');
	const available = $derived(tag ? (topics.find((topic) => topic.tag === tag)?.count ?? 0) : total);
	const size = $derived(Math.min(PRACTICE_SIZE, available));
</script>

<ActionCard
	id="practice"
	kicker="Practice"
	title="Mixed practice"
	description="Random questions from every deck, or from one topic. Nothing needs to be due."
	{href}
	action="Practice {size}"
>
	{#if topics.length > 0}
		<label class="topic">
			<span>Topic</span>
			<select bind:value={tag}>
				<option value="">All topics ({total})</option>
				{#each topics as topic (topic.tag)}
					<option value={topic.tag}>{tagLabel(topic.tag)} ({topic.count})</option>
				{/each}
			</select>
		</label>
	{/if}
</ActionCard>

<style>
	.topic {
		display: grid;
		gap: 6px;
		margin-top: 14px;
		color: var(--text-muted);
		font-size: 12px;
		font-weight: 700;
	}

	select {
		min-height: 44px;
		padding: 0 12px;
		border: 2px solid var(--line);
		border-radius: 12px;
		background: var(--bg);
		color: var(--text);
		font: inherit;
		font-size: 15px;
	}

	select:focus-visible {
		outline: 2px solid var(--accent-glow);
		outline-offset: 2px;
	}
</style>
