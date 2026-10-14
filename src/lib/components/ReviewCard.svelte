<script lang="ts">
	import { PRACTICE_SIZE } from '$lib/review/practice';
	import Button from './Button.svelte';

	interface Props {
		dueCount: number;
		/** Questions in one sitting. */
		sitting: number;
		/** Days until the next question is due, when none is due now. Null when nothing is scheduled. */
		nextInDays: number | null;
	}

	let { dueCount, sitting, nextInDays }: Props = $props();

	const taking = $derived(Math.min(dueCount, sitting));
	const nextText = $derived(
		nextInDays === null
			? 'Each answer joins the review schedule.'
			: nextInDays <= 1
				? 'Next review tomorrow.'
				: `Next review in ${nextInDays} days.`
	);
</script>

<article class="review" aria-labelledby="review-heading">
	<p class="kicker">Review</p>
	{#if dueCount > 0}
		<h2 id="review-heading">{dueCount} {dueCount === 1 ? 'question' : 'questions'} due</h2>
		<p class="description">
			{dueCount > taking ? `Today's sitting covers the ${taking} most overdue.` : 'Questions you missed or are due to see again.'}
		</p>
		<div class="start"><Button href="/review">Review {taking}</Button></div>
	{:else}
		<!-- Nothing is due, so the card offers practice rather than an empty space. -->
		<h2 id="review-heading">{nextInDays === null ? 'Nothing scheduled yet' : 'Nothing due'}</h2>
		<p class="description">{nextText}</p>
		<div class="start"><Button variant="outline" href="/practice">Practice {PRACTICE_SIZE}</Button></div>
	{/if}
</article>

<style>
	/* A column, so the button sits at the bottom and lines up with the other cards in its row. */
	.review {
		display: flex;
		flex-direction: column;
		padding: 19px;
		border: 2px solid var(--accent);
		border-radius: 16px;
		background: var(--accent-soft);
	}

	.kicker {
		color: var(--accent-glow);
		font-size: 10px;
		font-weight: 700;
		line-height: 15px;
		letter-spacing: 1.5px;
		text-transform: uppercase;
	}

	h2 {
		margin-top: 16.3px;
		font-size: 17px;
		font-weight: 700;
		line-height: 25px;
	}

	.description {
		margin-top: 5px;
		color: var(--text-muted);
		font-size: 13px;
		line-height: 19.2px;
	}

	.start {
		margin-top: auto;
		padding-top: 16.2px;
	}
</style>
