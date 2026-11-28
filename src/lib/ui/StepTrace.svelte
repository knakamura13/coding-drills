<!--
	A step-trace question's steps, below its code (Question formats, Trace A: stacked steps). Always in
	this order: the answered steps as results (a check or '!', then what was true), 'Step n of m',
	the current ask at 16/24 SemiBold, the strip with its pointers as tabs, then answer tiles when
	the step asks for a value. A cell step is answered by picking a cell, as in a tap-cell question; beside a
	value step the strip is only shown. Once a cell step is checked its pointer sits on the true cell
	in the branch tint, so the trace goes on from the truth.
-->
<script lang="ts">
	import type { BoardView, OptionView, TraceView } from '$lib/domain/lesson';
	import { plainText, renderInline } from '$lib/markdown/render';
	import AnswerTiles from './AnswerTiles.svelte';
	import Icon from './Icon.svelte';
	import PointerStrip from './PointerStrip.svelte';

	let {
		trace,
		board,
		options,
		name,
		selectedId,
		checked,
		atOnce,
		onselect,
		ask = $bindable(),
		strip = $bindable()
	}: {
		trace: TraceView;
		board: BoardView;
		options: readonly OptionView[];
		name: string;
		selectedId: string | null;
		checked: boolean;
		atOnce: boolean;
		onselect: (id: string) => void;
		/** The current step's ask, where focus goes when a new step opens. */
		ask?: HTMLElement;
		/** The strip and its tabs, kept in sight after a cell step's Check. */
		strip?: HTMLElement;
	} = $props();

	const onCells = $derived(trace.kind === 'cell');
</script>

{#if trace.done.length > 0}
	<ol class="done" aria-label="Answered steps">
		{#each trace.done as step, index (index)}
			<!-- renderInline escapes HTML first, so the output is safe to inject. -->
			<li>
				<Icon name={step.correct ? 'correct' : 'missed'} label={step.correct ? 'Right' : 'Not right'} />
				<span
					>Step {index + 1}: {#if step.ask}{@html renderInline(step.ask)}{' '}{/if}<span class="answer"
						>{@html renderInline(step.answer)}</span
					></span
				>
			</li>
		{/each}
	</ol>
{/if}

<div class="current">
	<p class="count">Step {trace.step} of {trace.total}</p>
	<h2 class="ask" tabindex="-1" bind:this={ask}>{@html renderInline(trace.ask)}</h2>
</div>

<div bind:this={strip}>
	<PointerStrip
		{board}
		{name}
		selectedId={onCells ? selectedId : null}
		checked={onCells && checked}
		{atOnce}
		{onselect}
		readonly={!onCells}
		lit={trace.pointer}
	/>
</div>

{#if !onCells}
	<AnswerTiles name="{name}-values" label={plainText(trace.ask, 300)} {options} {selectedId} {checked} {atOnce} {onselect} />
{/if}

<style>
	/* One result per answered step, wrapping when the ask is long. */
	.done {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
		color: var(--color-text-secondary);
		font-size: var(--text-label-size);
		line-height: var(--text-label-line);
	}

	.done li {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		color: var(--color-text-secondary);
	}

	/* The 16px icon centered on the first 20px line. */
	.done li > :global(.icon) {
		margin-top: 2px;
	}

	.answer {
		color: var(--color-text-primary);
		font-weight: var(--text-label-weight);
	}

	.current {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.count {
		color: var(--color-text-secondary);
		font-size: var(--text-caption-size);
		line-height: var(--text-caption-line);
	}

	/* The ask at 16/24 SemiBold. */
	.ask {
		font-size: var(--text-body-size);
		line-height: var(--text-body-line);
		font-weight: 600;
	}

	.ask:focus {
		outline: none;
	}
</style>
