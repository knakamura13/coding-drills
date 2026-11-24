<!--
	One 4px segment per question, done in the branch accent, the rest Twilight. No counter on screen
	(lesson Round 1); assistive technology reads it as a progress bar. A segment fills left to right
	in 150 ms when it completes (Round 7); with Reduce effects it fades in instead.
-->
<script lang="ts">
	let { total, done, label = 'Lesson progress' }: { total: number; done: number; label?: string } = $props();
</script>

<div
	class="segments"
	role="progressbar"
	aria-label={label}
	aria-valuemin="0"
	aria-valuemax={total}
	aria-valuenow={done}
	aria-valuetext="{done} of {total} questions done"
>
	{#each { length: total }, index (index)}
		<span class="segment"><span class="fill" class:done={index < done}></span></span>
	{/each}
</div>

<style>
	.segments {
		display: flex;
		gap: var(--space-1);
	}

	.segment {
		flex: 1;
		height: 4px;
		border-radius: 2px;
		overflow: hidden;
		background: var(--color-border-default);
	}

	/* --shift 1 grows the fill from nothing; --shift 0 starts it full width, so it only fades. */
	.fill {
		display: block;
		height: 100%;
		background: var(--accent);
		opacity: 0;
		transform: scaleX(calc(1 - var(--shift)));
		transform-origin: left;
		transition:
			transform var(--dur-state) var(--ease),
			opacity var(--dur-state) var(--ease);
	}

	.done {
		opacity: 1;
		transform: scaleX(1);
	}
</style>
