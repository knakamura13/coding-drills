<!--
	The summary's misses (lesson Round 6): an open list with hairline dividers and no header. Each
	row has the question title, the pick with a rose '!', the answer with a branch check, and, when
	the question had one, a "Follow-up question" line whose icon shows how it went.
-->
<script lang="ts">
	import type { MissedQuestion } from '$lib/domain/lesson';
	import { plainText, renderInline } from '$lib/markdown/render';
	import Icon from './Icon.svelte';

	let { misses, id }: { misses: readonly MissedQuestion[]; id?: string } = $props();
</script>

<ul class="misses" {id} aria-label="Missed questions">
	{#each misses as miss (miss.questionId)}
		<li class="miss">
			<p class="question">{miss.heading ?? plainText(miss.prompt, 90)}</p>
			<!-- renderInline escapes HTML first, so the output is safe to inject. -->
			<p class="line">
				<Icon name="missed" /><span><span class="visually-hidden">You picked:</span>{' '}{@html renderInline(miss.pickedText)}</span>
			</p>
			<p class="line">
				<Icon name="correct" /><span><span class="visually-hidden">The answer:</span>{' '}{@html renderInline(miss.correctText)}</span>
			</p>
			{#if miss.followUpCorrect !== null}
				<p class="line follow-up">
					<Icon name={miss.followUpCorrect ? 'correct' : 'missed'} />
					<span>Follow-up question<span class="visually-hidden">, {miss.followUpCorrect ? 'right' : 'missed'}</span></span>
				</p>
			{/if}
		</li>
	{/each}
</ul>

<style>
	.misses {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.miss {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 14px 0;
		border-top: 1px solid var(--color-border-default);
	}

	.miss:first-child {
		border-top: 0;
	}

	.question {
		font-size: 15px;
		line-height: 22px;
		font-weight: 600;
		color: var(--color-text-primary);
	}

	.line {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		font-size: var(--text-label-size);
		line-height: 22px;
		color: var(--color-text-primary);
	}

	.line :global(svg) {
		flex: none;
		margin-top: 3px;
	}

	.line :global(code) {
		font-family: var(--font-mono);
		font-size: 0.9375em;
		white-space: nowrap;
	}

	.line :global(code.long) {
		white-space: normal;
		overflow-wrap: anywhere;
	}

	.follow-up {
		color: var(--color-text-secondary);
		line-height: 20px;
	}
</style>
