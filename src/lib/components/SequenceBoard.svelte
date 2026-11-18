<script lang="ts">
	import { tick } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import type { BoardCellView, PointerView } from '$lib/domain/lesson';
	import Markdown from './Markdown.svelte';

	interface Props {
		presentation: 'array' | 'string';
		name?: string;
		cells: readonly BoardCellView[];
		/** Pointers the learner moves. Leave empty to make the cells themselves the answer. */
		pointers?: readonly PointerView[];
		note: string | null;
		locked: boolean;
		onselect: (id: string) => void;
		onplace?: (name: string, at: number) => void;
	}

	let { presentation, name, cells, pointers = [], note, locked, onselect, onplace }: Props = $props();

	const placing = $derived(pointers.length > 0);

	// Roving tabindex: one cell is in the tab order, and the arrows move it.
	// A later grid can map ArrowUp and ArrowDown onto rows instead of the line.
	let cursor = $state(0);
	let buttons = $state<(HTMLButtonElement | undefined)[]>([]);
	let boardEl: HTMLDivElement | undefined = $state();
	let scroller: HTMLDivElement | undefined = $state();

	// Placing: a pointer is picked up by a press, or armed by a tap and then sent to a tapped cell.
	// A lone pointer is always armed, so one tap on a cell moves it.
	let armed = $state<string | null>(null);
	let drag = $state<{ name: string; over: number; dx: number; dy: number; moved: boolean } | null>(null);
	let originX = 0;
	let originY = 0;

	const target = $derived(armed ?? (pointers.length === 1 ? pointers[0]!.name : null));

	const groupLabel = $derived(
		placing
			? `${name ? `${name} ` : ''}${presentation}, ${cells.length} ${cells.length === 1 ? 'cell' : 'cells'}. Drag a pointer to a cell, or tap a pointer and then a cell. With a pointer focused, the arrow keys move it.`
			: `${name ? `${name} ` : ''}${presentation}, ${cells.length} ${cells.length === 1 ? 'cell' : 'cells'}. Tap a cell, or use the arrow keys and Enter.`
	);

	function accessibleName(cell: BoardCellView): string {
		const parts = [`Index ${cell.index}`];
		if (cell.pastEnd) parts.push('past the end');
		else if (cell.value === '') parts.push('empty');
		else parts.push(`value ${cell.value}`);
		if (cell.markers.length > 0) parts.push(`markers ${cell.markers.join(' ')}`);
		const here = pointers.filter((pointer) => pointer.at === cell.index).map((pointer) => pointer.name);
		if (here.length > 0) parts.push(`pointers ${here.join(' ')}`);
		if (cell.tone === 'correct') parts.push('correct');
		else if (cell.tone === 'wrong') parts.push('not quite');
		return parts.join(', ');
	}

	function pointerName(pointer: PointerView): string {
		const parts = [`${pointer.name} pointer, at index ${pointer.at}`];
		if (pointer.tone === 'correct') parts.push('correct');
		else if (pointer.tone === 'wrong') parts.push(`not quite, it belongs at index ${pointer.correctAt}`);
		else if (armed === pointer.name) parts.push('picked up, tap a cell to move it');
		return parts.join(', ');
	}

	function choose(cell: BoardCellView) {
		if (locked) return;
		if (!placing) {
			onselect(cell.id);
			return;
		}
		if (target) onplace?.(target, cell.index);
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

	function focusPointer(pointerNameToFocus: string) {
		void tick().then(() => boardEl?.querySelector<HTMLElement>(`[data-pointer="${pointerNameToFocus}"]`)?.focus());
	}

	function movePointer(event: KeyboardEvent, pointer: PointerView) {
		if (locked) return;
		let next = pointer.at;
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = Math.min(cells.length - 1, pointer.at + 1);
		else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = Math.max(0, pointer.at - 1);
		else if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = cells.length - 1;
		else return;
		event.preventDefault();
		event.stopPropagation();
		if (next !== pointer.at) {
			onplace?.(pointer.name, next);
			focusPointer(pointer.name);
		}
	}

	/** The cell whose centre is nearest the finger, so a drop between two cells still lands. */
	function indexAt(x: number): number | null {
		let best: number | null = null;
		let distance = Infinity;
		buttons.forEach((button, index) => {
			if (!button) return;
			const box = button.getBoundingClientRect();
			const gap = Math.abs(x - (box.left + box.width / 2));
			if (gap < distance) {
				distance = gap;
				best = index;
			}
		});
		return best;
	}

	// A drag listens on the window, not on the handle, so it follows the finger even where the
	// browser refuses pointer capture (WebKit does for some pointer kinds) or the handle moves.
	let stopListening = () => {};

	function grab(event: PointerEvent, pointer: PointerView) {
		if (locked || event.button > 0) return;
		stopListening();
		originX = event.clientX;
		originY = event.clientY;
		drag = { name: pointer.name, over: pointer.at, dx: 0, dy: 0, moved: false };
		const id = event.pointerId;
		const onmove = (next: PointerEvent) => {
			if (next.pointerId === id) drift(next);
		};
		const onup = (next: PointerEvent) => {
			if (next.pointerId !== id) return;
			stopListening();
			drop(pointer);
		};
		const oncancel = (next: PointerEvent) => {
			if (next.pointerId !== id) return;
			stopListening();
			drag = null;
		};
		window.addEventListener('pointermove', onmove);
		window.addEventListener('pointerup', onup);
		window.addEventListener('pointercancel', oncancel);
		stopListening = () => {
			window.removeEventListener('pointermove', onmove);
			window.removeEventListener('pointerup', onup);
			window.removeEventListener('pointercancel', oncancel);
			stopListening = () => {};
		};
	}

	$effect(() => () => stopListening());

	function drift(event: PointerEvent) {
		if (!drag) return;
		const dx = event.clientX - originX;
		const dy = event.clientY - originY;
		const moved = drag.moved || Math.hypot(dx, dy) > 6;
		drag = { ...drag, dx, dy, moved, over: moved ? (indexAt(event.clientX) ?? drag.over) : drag.over };
		// Near the edge of a row that scrolls, bring the next cells into reach.
		if (moved && scroller) {
			const box = scroller.getBoundingClientRect();
			if (event.clientX < box.left + 36) scroller.scrollLeft -= 12;
			else if (event.clientX > box.right - 36) scroller.scrollLeft += 12;
		}
	}

	function drop(pointer: PointerView) {
		if (!drag) return;
		const done = drag;
		drag = null;
		if (done.moved) {
			armed = pointer.name;
			if (done.over !== pointer.at) onplace?.(pointer.name, done.over);
			focusPointer(pointer.name);
		} else {
			// A tap on the handle: arm it, or put it down again.
			armed = armed === pointer.name ? null : pointer.name;
		}
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

	const notes = $derived(pointers.filter((pointer) => pointer.note));
</script>

<div class="board" bind:this={boardEl}>
	<p class="caption">
		{#if name}<span class="seq-name">{name}</span>{/if}
		<span class="kind">{presentation}</span>
	</p>
	<div class="scroller" bind:this={scroller}>
		<div class="row" role="group" aria-label={groupLabel}>
			{#each cells as cell, index (cell.id)}
				<div class={['col', { past: cell.pastEnd }]}>
					<div class="markers">
						<span class="fixed" aria-hidden="true">
							{#each cell.markers as marker (marker)}
								<span class="pointer">{marker}</span>
							{/each}
						</span>
						{#each pointers.filter((pointer) => pointer.correctAt === cell.index) as pointer (pointer.name)}
							<span class="pointer ghost" aria-hidden="true">{pointer.name}</span>
						{/each}
						{#each pointers.filter((pointer) => pointer.at === cell.index) as pointer (pointer.name)}
							<button
								type="button"
								class={[
									'handle',
									pointer.tone,
									{ armed: armed === pointer.name && pointer.tone === 'idle', lifted: drag?.name === pointer.name && drag.moved }
								]}
								aria-label={pointerName(pointer)}
								aria-pressed={pointer.tone === 'idle' ? armed === pointer.name : undefined}
								aria-disabled={locked}
								aria-describedby={pointer.note ? 'cell-feedback' : undefined}
								data-pointer={pointer.name}
								data-at={pointer.at}
								data-tone={pointer.tone}
								style:transform={drag?.name === pointer.name && drag.moved ? `translate(${drag.dx}px, ${drag.dy}px)` : undefined}
								onpointerdown={(event) => grab(event, pointer)}
								onkeydown={(event) => movePointer(event, pointer)}
							>
								{pointer.name}
							</button>
						{/each}
					</div>
					<button
						type="button"
						class={[
							'cell',
							cell.tone,
							{ snap: cell.tone === 'correct' && !cell.reveal, reveal: cell.reveal, drop: drag?.moved && drag.over === cell.index }
						]}
						{@attach remember(index)}
						tabindex={index === cursor ? 0 : -1}
						aria-label={accessibleName(cell)}
						aria-disabled={locked}
						aria-describedby={note && (cell.tone === 'wrong' || (cell.tone === 'correct' && !cell.reveal))
							? 'cell-feedback'
							: undefined}
						data-index={cell.index}
						data-tone={cell.tone}
						onclick={() => choose(cell)}
						onkeydown={(event) => move(event, index)}
					>
						<span class="value" aria-hidden="true">{cell.pastEnd ? '' : cell.value}</span>
						<span class="index" aria-hidden="true">{cell.index}</span>
					</button>
				</div>
			{/each}
		</div>
	</div>
	{#if placing && !locked}
		<p class="hint">
			{#if armed}
				<strong>{armed}</strong> is picked up. Tap a cell to put it there.
			{:else}
				Drag a pointer to its cell, or tap the pointer and then a cell.
			{/if}
		</p>
	{/if}
	{#if note}
		<div class="note {cells.some((cell) => cell.tone === 'wrong') ? 'wrong' : 'correct'}" id="cell-feedback">
			<Markdown source={note} />
		</div>
	{:else if notes.length > 0}
		<div class="notes" id="cell-feedback">
			{#each notes as pointer (pointer.name)}
				<div class="note {pointer.tone === 'wrong' ? 'wrong' : 'correct'}">
					<Markdown source={`\`${pointer.name}\`: ${pointer.note}`} />
				</div>
			{/each}
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

	.markers .fixed {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}

	.hint {
		margin-top: 10px;
		color: var(--text-muted);
		font-size: 14px;
		line-height: 1.4;
	}

	.notes {
		display: grid;
		gap: 8px;
		margin-top: 12px;
		scroll-margin-bottom: calc(var(--sheet-h, 160px) + 16px);
	}

	.notes .note {
		margin-top: 0;
	}

	/* A pointer is a grab handle. 44px tall and as wide as its name, so a thumb can hold it. */
	.handle {
		min-width: 44px;
		min-height: 44px;
		padding: 6px 12px;
		border: 2px solid var(--accent);
		border-radius: 12px;
		background: var(--accent-soft);
		color: var(--text);
		font-family: var(--mono);
		font-size: 14px;
		font-weight: 800;
		cursor: grab;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	}

	.handle.armed {
		border-color: var(--accent-glow);
		outline: 3px solid var(--accent-glow);
		outline-offset: 2px;
	}

	.handle:focus-visible {
		outline: 3px solid var(--accent-glow);
		outline-offset: 3px;
	}

	.handle.lifted {
		position: relative;
		z-index: 2;
		cursor: grabbing;
		box-shadow: 0 6px 18px rgb(0 0 0 / 0.35);
	}

	.handle.correct {
		border-color: var(--right-line);
		background: var(--right-bg);
		color: var(--right-text);
	}

	.handle.wrong {
		border-color: var(--wrong-line);
		background: var(--wrong-bg);
		color: var(--wrong-text);
	}

	.handle[aria-disabled='true'] {
		cursor: default;
	}

	.pointer.ghost {
		color: var(--right-text);
	}

	.pointer.ghost::after {
		border-top-color: var(--right-text);
	}

	.cell.drop {
		border-color: var(--accent-glow);
		background: var(--accent-soft);
	}

	@media (prefers-reduced-motion: no-preference) {
		.pointer.ghost {
			animation: reveal 280ms ease 380ms both;
		}
	}
</style>
