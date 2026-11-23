<!--
	A sequence as one joined strip of cells (lesson Round 3, Cells B; Round 4 feedback on cells).
	Indices sit above in Mist mono, markers below in Frost mono. By default the cells are a native
	radio group, like the answer tiles: a tap or the arrow keys pick a cell, and Check answers. With
	"Immediate feedback" on, a tap is the answer, so the cells become buttons whose arrow keys only
	move focus. After Check: the right cell takes the branch tint and border with a check, a wrong
	tap a rose border and '!', both inside the cell's top-right corner, and the rest dim to Mist.
	Cells grow to fit long values, and a strip wider than the screen scrolls sideways.
-->
<script lang="ts">
	import type { BoardCellView, BoardView } from '$lib/domain/lesson';
	import Icon from './Icon.svelte';
	import { roving } from './roving';

	let {
		board,
		selectedId,
		checked,
		name,
		atOnce = false,
		onselect
	}: {
		board: BoardView;
		/** The learner's pick, before and after Check. */
		selectedId: string | null;
		/** True once the answer has been checked: the cells show the result and stop taking taps. */
		checked: boolean;
		name: string;
		/** A tap answers at once: buttons with arrow-key focus instead of radios. */
		atOnce?: boolean;
		onselect: (id: string) => void;
	} = $props();

	const kind = $derived(board.presentation === 'string' ? 'String' : 'Array');
	const label = $derived(`${kind}${board.name ? ` ${board.name}` : ''}, ${board.cells.length} ${board.cells.length === 1 ? 'cell' : 'cells'}`);
	const lastValue = $derived(board.cells.findLast((cell) => !cell.pastEnd)?.index ?? -1);

	function look(cell: BoardCellView): string {
		if (!checked) return cell.tone === 'selected' ? 'selected' : 'rest';
		return cell.tone === 'correct' ? 'correct' : cell.tone === 'wrong' ? 'wrong' : 'dimmed';
	}

	function accessibleName(cell: BoardCellView, state: string): string {
		const parts = [`Index ${cell.index}`];
		if (cell.pastEnd) parts.push('past the end');
		else if (cell.value === '') parts.push('empty');
		else parts.push(cell.value);
		if (cell.markers.length > 0) parts.push(`marked ${cell.markers.join(' and ')}`);
		if (state === 'correct') parts.push('the right cell');
		else if (state === 'wrong') parts.push('your tap, not right');
		return parts.join(', ');
	}
</script>

{#snippet face(cell: BoardCellView, state: string)}
	<span class="value">{cell.value}</span>
	{#if state === 'correct'}
		<span class="badge"><Icon name="correct" small /></span>
	{:else if state === 'wrong'}
		<span class="badge"><Icon name="missed" small /></span>
	{/if}
{/snippet}

<!-- Padding inside the scroller leaves room for the focus ring, which a scroller would clip. -->
<div class="scroller">
	<fieldset class="strip" disabled={checked}>
		<legend class="visually-hidden">{label}</legend>
		{#each board.cells as cell (cell.id)}
			{@const state = look(cell)}
			<div class="column" class:past={cell.pastEnd} class:first={cell.index === 0} class:last={cell.index === lastValue}>
				<span class="index" aria-hidden="true">{cell.index}</span>
				{#if atOnce}
					<button
						type="button"
						class="cell {state}"
						aria-label={accessibleName(cell, state)}
						tabindex={cell.index === 0 ? 0 : -1}
						onkeydown={roving}
						onclick={() => onselect(cell.id)}
					>
						{@render face(cell, state)}
					</button>
				{:else}
					<label class="cell {state}">
						<input
							class="radio"
							type="radio"
							{name}
							value={cell.id}
							aria-label={accessibleName(cell, state)}
							checked={cell.id === selectedId}
							onchange={() => onselect(cell.id)}
						/>
						{@render face(cell, state)}
					</label>
				{/if}
				<span class="markers" aria-hidden="true">{cell.markers.join(' ')}</span>
			</div>
		{/each}
	</fieldset>
</div>

<style>
	.scroller {
		overflow-x: auto;
		padding: var(--space-1);
		margin: calc(-1 * var(--space-1));
	}

	.strip {
		display: flex;
		width: max-content;
		border: 0;
		min-width: 0;
	}

	.column {
		display: grid;
		grid-template-rows: 16px 48px 16px;
		row-gap: 6px;
		min-width: 44px;
		text-align: center;
		font-family: var(--font-mono);
		font-size: var(--text-caption-size);
		line-height: var(--text-caption-line);
	}

	/* Joined cells: each overlaps the one before by its border, so dividers stay 1px. */
	.column + .column {
		margin-left: -1px;
	}

	/* The slot past the end stands apart, dashed. */
	.column.past {
		margin-left: var(--space-2);
	}

	.index {
		color: var(--color-text-secondary);
	}

	.markers {
		color: var(--neutral-frost);
		font-weight: 500;
		white-space: nowrap;
	}

	.cell {
		position: relative;
		display: grid;
		place-items: center;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border-default);
		background: var(--color-surface-card);
		color: var(--color-text-primary);
		font: inherit;
		font-size: var(--text-code-size);
		line-height: 20px;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background-color var(--dur-state) var(--ease),
			border-color var(--dur-state) var(--ease),
			box-shadow var(--dur-state) var(--ease),
			color var(--dur-state) var(--ease);
	}

	.first .cell {
		border-radius: var(--radius-control) 0 0 var(--radius-control);
	}

	.last .cell {
		border-radius: 0 var(--radius-control) var(--radius-control) 0;
	}

	.first.last .cell,
	.past .cell {
		border-radius: var(--radius-control);
	}

	.past .cell {
		border-style: dashed;
	}

	.rest:active {
		background: var(--color-surface-hover);
		border-color: var(--color-border-strong);
		z-index: 1;
	}

	/* The Tile B outline: a 2px edge drawn as border plus inset ring, so the value does not move. */
	.selected {
		background: var(--color-surface-hover);
		border-color: var(--color-text-primary);
		box-shadow: inset 0 0 0 1px var(--color-text-primary);
		z-index: 1;
	}

	.correct {
		background: var(--accent-tint);
		border-color: var(--accent-border);
		z-index: 1;
	}

	.wrong {
		border-color: var(--color-feedback-wrong-border);
		z-index: 1;
	}

	.dimmed {
		color: var(--color-text-secondary);
	}

	.strip:disabled .cell {
		cursor: default;
	}

	.badge {
		position: absolute;
		top: 3px;
		right: 3px;
		display: grid;
	}

	.radio {
		position: absolute;
		inset: 0;
		opacity: 0;
		margin: 0;
		cursor: inherit;
	}

	.cell:has(.radio:focus-visible),
	button.cell:focus-visible {
		outline: 2px solid var(--color-focus-ring);
		outline-offset: 2px;
		z-index: 2;
	}
</style>
