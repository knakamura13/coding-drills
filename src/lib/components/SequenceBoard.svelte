<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import type { BoardCellView } from '$lib/domain/lesson';
	import Markdown from './Markdown.svelte';

	interface Props {
		presentation: 'array' | 'string';
		name?: string;
		cells: readonly BoardCellView[];
		note: string | null;
		locked: boolean;
		onselect: (id: string) => void;
	}

	let { presentation, name, cells, note, locked, onselect }: Props = $props();

	// Roving tabindex: one cell is in the tab order, and the arrows move it.
	// A later grid can map ArrowUp and ArrowDown onto rows instead of the line.
	let cursor = $state(0);
	let buttons = $state<(HTMLButtonElement | undefined)[]>([]);

	const groupLabel = $derived(
		`${name ? `${name} ` : ''}${presentation}, ${cells.length} ${cells.length === 1 ? 'cell' : 'cells'}. Tap a cell, or use the arrow keys and Enter.`
	);

	function accessibleName(cell: BoardCellView): string {
		const parts = [`Index ${cell.index}`];
		if (cell.pastEnd) parts.push('past the end');
		else if (cell.value === '') parts.push('empty');
		else parts.push(`value ${cell.value}`);
		if (cell.markers.length > 0) parts.push(`markers ${cell.markers.join(' ')}`);
		if (cell.tone === 'correct') parts.push('correct');
		else if (cell.tone === 'wrong') parts.push('not quite');
		return parts.join(', ');
	}

	function choose(id: string) {
		if (locked) return;
		onselect(id);
	}

	function move(event: KeyboardEvent, index: number) {
		let next = index;
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = Math.min(cells.length - 1, index + 1);
		else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = Math.max(0, index - 1);
		else if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = cells.length - 1;
		else return;
		event.preventDefault();
		event.stopPropagation();
		cursor = next;
		buttons[next]?.focus();
	}

	// Stable per index so a re-render does not detach the button the learner is moving to.
	const remembered: Array<Attachment<HTMLButtonElement> | undefined> = [];
	function remember(index: number): Attachment<HTMLButtonElement> {
		let attachment = remembered[index];
		if (!attachment) {
			attachment = (node) => {
				buttons[index] = node;
				return () => {
					if (buttons[index] === node) buttons[index] = undefined;
				};
			};
			remembered[index] = attachment;
		}
		return attachment;
	}
</script>

<div class="board">
	<p class="caption">
		{#if name}<span class="seq-name">{name}</span>{/if}
		<span class="kind">{presentation}</span>
	</p>
	<div class="scroller">
		<div class="row" role="group" aria-label={groupLabel}>
			{#each cells as cell, index (cell.id)}
				<div class={['col', { past: cell.pastEnd }]}>
					<div class="markers" aria-hidden="true">
						{#each cell.markers as marker (marker)}
							<span class="pointer">{marker}</span>
						{/each}
					</div>
					<button
						type="button"
						class={['cell', cell.tone, { snap: cell.tone === 'correct' && !cell.reveal, reveal: cell.reveal }]}
						{@attach remember(index)}
						tabindex={index === cursor ? 0 : -1}
						aria-label={accessibleName(cell)}
						aria-disabled={locked}
						aria-describedby={note && (cell.tone === 'wrong' || (cell.tone === 'correct' && !cell.reveal))
							? 'cell-feedback'
							: undefined}
						data-index={cell.index}
						data-tone={cell.tone}
						onclick={() => choose(cell.id)}
						onkeydown={(event) => move(event, index)}
					>
						<span class="value" aria-hidden="true">{cell.pastEnd ? '' : cell.value}</span>
						<span class="index" aria-hidden="true">{cell.index}</span>
					</button>
				</div>
			{/each}
		</div>
	</div>
	{#if note}
		<div class="note {cells.some((cell) => cell.tone === 'wrong') ? 'wrong' : 'correct'}" id="cell-feedback">
			<Markdown source={note} />
		</div>
	{/if}
</div>

<style>
	.board {
		min-width: 0;
	}

	.caption {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin-bottom: 8px;
		color: var(--text-muted);
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.4px;
	}

	.seq-name {
		font-family: var(--mono);
		font-size: 14px;
		color: var(--code-text);
	}

	.kind {
		text-transform: uppercase;
		letter-spacing: 0.6px;
	}

	/* Padding keeps the focus ring inside the scroller when a long row scrolls. */
	.scroller {
		overflow-x: auto;
		padding: 6px 4px 8px;
		margin: 0 -4px;
	}

	.row {
		display: flex;
		align-items: end;
		gap: 8px;
		width: max-content;
		min-width: 100%;
	}

	.col {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.col.past {
		margin-left: 10px;
	}

	.markers {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		min-height: 1.15em;
	}

	.pointer {
		display: flex;
		flex-direction: column;
		align-items: center;
		color: var(--accent-glow);
		font-family: var(--mono);
		font-size: 12px;
		font-weight: 800;
		line-height: 1.1;
	}

	.pointer::after {
		content: '';
		margin-top: 2px;
		border-left: 5px solid transparent;
		border-right: 5px solid transparent;
		border-top: 6px solid var(--accent-glow);
	}

	/* The value and its index are one target, comfortably above 44px on a phone. */
	.cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-width: 52px;
		min-height: 64px;
		padding: 8px 10px 6px;
		border: 2px solid var(--line);
		border-bottom-width: 4px;
		border-radius: 12px;
		background: var(--bg);
		color: var(--text);
		font: inherit;
		cursor: pointer;
		touch-action: manipulation;
	}

	.col.past .cell {
		border-style: dashed;
		background: transparent;
	}

	.value {
		min-height: 1.2em;
		font-family: var(--mono);
		font-size: 18px;
		font-weight: 700;
		line-height: 1.2;
	}

	.index {
		font-size: 12px;
		font-weight: 800;
		line-height: 1.2;
		color: var(--text-muted);
	}

	.cell:focus-visible {
		border-color: var(--accent-glow);
		background: var(--accent-soft);
		outline: 3px solid var(--accent-glow);
		outline-offset: 3px;
	}

	@media (hover: hover) {
		.cell:hover:not([aria-disabled='true']) {
			border-color: var(--line-hover);
		}
	}

	.cell.selected {
		border-color: var(--accent);
		background: var(--accent-soft);
	}

	.cell.correct {
		border-color: var(--right-line);
		background: var(--right-bg);
		color: var(--right-text);
	}

	.cell.correct .index {
		color: var(--right-text);
	}

	.cell.wrong {
		border-color: var(--wrong-line);
		background: var(--wrong-bg);
		color: var(--wrong-text);
	}

	.cell.wrong .index {
		color: var(--wrong-text);
	}

	.cell[aria-disabled='true'] {
		cursor: default;
	}

	.note {
		margin-top: 12px;
		padding: 12px 14px;
		border: 2px solid var(--line);
		border-radius: 12px;
		font-size: 15px;
		line-height: 1.45;
		scroll-margin-bottom: calc(var(--sheet-h, 160px) + 16px);
	}

	.note.wrong {
		border-color: var(--wrong-line);
		background: var(--wrong-bg);
		color: var(--wrong-text);
	}

	.note.correct {
		border-color: var(--right-line);
		background: var(--right-bg);
		color: var(--right-text);
	}

	@media (prefers-reduced-motion: no-preference) {
		.cell.snap {
			animation: snap 320ms cubic-bezier(0.2, 0.9, 0.2, 1);
		}

		.cell.reveal {
			animation: reveal 280ms ease 380ms both;
		}
	}

	@keyframes snap {
		0% {
			transform: scale(0.94);
		}
		55% {
			transform: scale(1.08);
		}
		100% {
			transform: scale(1);
		}
	}

	@keyframes reveal {
		from {
			transform: scale(0.92);
		}
		to {
			transform: scale(1);
		}
	}
</style>
