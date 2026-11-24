<!--
	The feedback panel (lesson Round 4, Feedback D). After Check the footer becomes this panel,
	rising from below the screen edge in 150 ms (Round 7, A Rise); with Reduce effects it fades in.
	Correct: 12% branch tint, branch-border top edge, branch check and title. Not quite: Night with
	the soft rose top edge and a rose '!'. It never repeats the answer, since the tiles show it.
	Focus moves to Continue when it appears, because the Check button it replaces is gone.
-->
<script lang="ts">
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';
	import Prose from './Prose.svelte';

	let {
		correct,
		explanation,
		action = 'Continue',
		oncontinue,
		panel = $bindable()
	}: {
		correct: boolean;
		explanation: string;
		action?: string;
		oncontinue: () => void;
		/** The panel, for keeping what it explains in sight above it. */
		panel?: HTMLElement;
	} = $props();

	let actionWrap: HTMLDivElement;

	$effect(() => {
		actionWrap.querySelector('button')?.focus();
	});
</script>

<section class="panel" class:correct bind:this={panel} aria-label={correct ? 'Correct' : 'Not quite'}>
	<div class="actions-column">
		<p class="title">
			<Icon name={correct ? 'correct' : 'missed'} />
			{correct ? 'Correct' : 'Not quite'}
		</p>
		{#if explanation}<Prose source={explanation} />{/if}
		<div bind:this={actionWrap}><Button onclick={oncontinue}>{action}</Button></div>
	</div>
</section>

<style>
	.panel {
		position: sticky;
		bottom: 0;
		z-index: 1;
		border-top: 1px solid var(--color-feedback-wrong-border);
		background: var(--color-surface-card);
		padding: var(--space-4) var(--space-screen-edge) max(var(--space-4), env(safe-area-inset-bottom));
		animation: rise var(--dur-state) var(--ease) both;
	}

	.correct {
		border-top-color: var(--accent-border);
		background: var(--accent-tint);
	}

	/* Full effects slide it up from below the edge; Reduce effects (--shift 0) only fades it in. */
	@keyframes rise {
		from {
			transform: translateY(calc(100% * var(--shift)));
			opacity: var(--shift);
		}
	}

	.actions-column {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		max-width: 640px;
		margin: 0 auto;
	}

	.title {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-heading-size);
		line-height: var(--text-heading-line);
		font-weight: var(--text-heading-weight);
	}

	.correct .title {
		color: var(--accent);
	}
</style>
