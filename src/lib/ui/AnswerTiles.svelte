<!--
	Multiple-choice answers as tiles (lesson Round 3, Tile B; Round 4, Feedback D). Native radio
	inputs, so arrow keys move between answers and screen readers announce a radio group. With
	"Immediate feedback" on, a pick is the answer, so the tiles become buttons instead: arrow keys
	only move focus, and Enter, Space or a tap answers.
	Before Check: rest, pressed and selected. After Check: the right answer takes the branch tint and
	border with a check, a wrong pick a rose border and '!', and every other answer dims to Mist.
-->
<script lang="ts">
	import { renderInline } from '$lib/markdown/render';
	import type { OptionView } from '$lib/domain/lesson';
	import Icon from './Icon.svelte';
	import { roving } from './roving';

	let {
		options,
		selectedId,
		checked,
		label,
		name,
		atOnce = false,
		onselect
	}: {
		options: readonly OptionView[];
		/** The learner's pick, before and after Check. */
		selectedId: string | null;
		/** True once the answer has been checked: the tiles show the result and stop taking picks. */
		checked: boolean;
		/** The question, as the group's accessible name. */
		label: string;
		name: string;
		/** A press answers at once: buttons with arrow-key focus instead of radios. */
		atOnce?: boolean;
		onselect: (id: string) => void;
	} = $props();

	function look(option: OptionView): string {
		if (!checked) return option.state === 'selected' ? 'selected' : 'rest';
		return option.state === 'correct' ? 'correct' : option.state === 'wrong' ? 'wrong' : 'dimmed';
	}
</script>

{#snippet face(option: OptionView, state: string)}
	<!-- renderInline escapes HTML first, so the output is safe to inject. -->
	<span class="text">{@html renderInline(option.text)}</span>
	{#if state === 'correct'}
		<Icon name="correct" /><span class="visually-hidden">, the right answer</span>
	{:else if state === 'wrong'}
		<Icon name="missed" /><span class="visually-hidden">, your answer, not right</span>
	{/if}
{/snippet}

<fieldset class="tiles" disabled={checked}>
	<legend class="visually-hidden">{label}</legend>
	{#each options as option, index (option.id)}
		{@const state = look(option)}
		{#if atOnce}
			<button type="button" class="tile {state}" tabindex={index === 0 ? 0 : -1} onkeydown={roving} onclick={() => onselect(option.id)}>
				{@render face(option, state)}
			</button>
		{:else}
			<label class="tile {state}">
				<input
					class="radio"
					type="radio"
					{name}
					value={option.id}
					checked={option.id === selectedId}
					onchange={() => onselect(option.id)}
				/>
				{@render face(option, state)}
			</label>
		{/if}
	{/each}
</fieldset>

<style>
	.tiles {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		border: 0;
		min-width: 0;
	}

	.tile {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: 56px;
		padding: var(--space-4);
		border: 1px solid var(--color-border-default);
		border-radius: var(--radius-control);
		background: var(--color-surface-card);
		color: var(--color-text-primary);
		cursor: pointer;
		font: inherit;
		text-align: start;
		transition:
			background-color var(--dur-state) var(--ease),
			border-color var(--dur-state) var(--ease),
			color var(--dur-state) var(--ease);
	}

	/* The 2px selected border would shift the text by 1px; an inset ring keeps it still. */
	.selected {
		background: var(--color-surface-hover);
		border-color: transparent;
		box-shadow: inset 0 0 0 2px var(--color-text-primary);
	}

	.rest:active {
		background: var(--color-surface-hover);
		border-color: var(--color-border-strong);
	}

	.correct {
		background: var(--accent-tint);
		border-color: var(--accent-border);
	}

	.wrong {
		border-color: var(--color-feedback-wrong-border);
	}

	.dimmed {
		color: var(--color-text-secondary);
	}

	.tiles:disabled .tile {
		cursor: default;
	}

	.text {
		flex: 1;
		min-width: 0;
		text-wrap: pretty;
	}

	.text :global(code) {
		font-family: var(--font-mono);
		font-size: 0.9375em;
		white-space: nowrap;
	}

	.text :global(code.long) {
		white-space: normal;
		overflow-wrap: anywhere;
	}

	/* The radio stays in the accessibility tree and takes focus; the tile shows its state. */
	.radio {
		position: absolute;
		inset: 0;
		opacity: 0;
		margin: 0;
		cursor: inherit;
	}

	.tile:has(.radio:focus-visible),
	button.tile:focus-visible {
		outline: 2px solid var(--color-focus-ring);
		outline-offset: 2px;
	}
</style>
