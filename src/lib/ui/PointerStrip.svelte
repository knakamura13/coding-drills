<!--
	A drag-pointers question's sequence (Question formats, Drag A): the strip of cells, with each
	pointer as a labeled tab under its cell, caret pointing up. Drag a tab to a cell, or tap a tab to
	pick it up and then tap a cell; a lone pointer is always picked up. With a tab focused, the arrow
	keys, Home and End move it. A picked-up tab takes the Tile B outline.
	After Check, a right pointer takes the branch tint and border with a check, a wrong one a rose
	border and '!', and a dashed branch-color ghost tab shows where it belonged, in a row below.
	Tabs never overlap: two on one cell, or long names on neighboring cells, stack in rows.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import type { BoardView, PointerView } from '$lib/domain/lesson';
	import CellStrip from './CellStrip.svelte';
	import Icon from './Icon.svelte';
	import { stackRows } from './tabRows';

	let {
		board,
		checked,
		name,
		onplace
	}: {
		board: BoardView;
		/** True once the answer has been checked: the tabs show the result and stop moving. */
		checked: boolean;
		name: string;
		onplace: (pointer: string, at: number) => void;
	} = $props();

	const pointers = $derived(board.pointers);
	const lone = $derived(pointers.length === 1 ? pointers[0]!.name : null);

	let track: HTMLElement | undefined = $state();
	let layer: HTMLElement | undefined = $state();

	// Cell centers in the track, measured, since cells grow with their values.
	let centers = $state<number[]>([]);
	let trackWidth = $state(0);
	function measure() {
		if (!track) return;
		trackWidth = track.offsetWidth;
		const origin = track.getBoundingClientRect().left;
		centers = [...track.querySelectorAll<HTMLElement>('[data-index]')].map((cell) => {
			const box = cell.getBoundingClientRect();
			return box.left - origin + box.width / 2;
		});
	}
	$effect(() => {
		if (!track) return;
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(track);
		return () => observer.disconnect();
	});

	// Tab widths, measured, and the rows that keep them apart.
	let widths = $state<Record<string, number>>({});
	let ghostWidths = $state<Record<string, number>>({});
	const ROW = 36;
	const GHOST_ROW = 32;
	// Neighbors may sit 2px apart, as in the design; only tabs that would touch stack.
	const rows = $derived(stackRows(pointers.map((pointer) => ({ center: centers[pointer.at] ?? 0, width: widths[pointer.name] ?? 40 })), 2));
	const ghosts = $derived(checked ? pointers.filter((pointer) => pointer.tone === 'wrong' && pointer.correctAt !== null) : []);
	const ghostRows = $derived(
		stackRows(ghosts.map((pointer) => ({ center: centers[pointer.correctAt!] ?? 0, width: ghostWidths[pointer.name] ?? 40 })), 2)
	);
	const tabRowCount = $derived(pointers.length ? Math.max(...rows) + 1 : 0);
	const ghostRowCount = $derived(ghosts.length ? Math.max(...ghostRows) + 1 : 0);
	const height = $derived(tabRowCount * ROW + (ghostRowCount ? 4 + ghostRowCount * GHOST_ROW : 0));

	// Picking up: a tap arms a pointer for the next cell tap. A lone pointer is always armed.
	let armed = $state<string | null>(null);
	const target = $derived(armed ?? lone);
	let announcement = $state('');

	/** A tab centered on its cell, kept inside the track so the scroller never cuts it. */
	function left(center: number, width: number): number {
		return Math.max(0, Math.min(Math.max(0, trackWidth - width), center - width / 2));
	}

	function focusTab(pointerName: string) {
		void tick().then(() => layer?.querySelector<HTMLElement>(`[data-pointer="${pointerName}"]`)?.focus());
	}

	function place(pointerName: string, at: number) {
		const pointer = pointers.find((one) => one.name === pointerName);
		if (!pointer || pointer.at === at) return;
		onplace(pointerName, at);
		announcement = `${pointerName} moved to index ${at}.`;
	}

	function cellTapped(index: number) {
		if (checked || !target) return;
		place(target, index);
		armed = null;
	}

	// Dragging follows the finger on the window, past the tab and where WebKit refuses pointer
	// capture. A press that moves less than 6px is a tap.
	let drag = $state<{ name: string; dx: number; dy: number; over: number } | null>(null);
	let suppressClick = false;
	let stopDrag = () => {};

	function nearest(clientX: number): number {
		const origin = track?.getBoundingClientRect().left ?? 0;
		const x = clientX - origin;
		let best = 0;
		centers.forEach((center, index) => {
			if (Math.abs(center - x) < Math.abs(centers[best]! - x)) best = index;
		});
		return best;
	}

	function grab(event: PointerEvent, pointer: PointerView) {
		if (checked || event.button > 0) return;
		stopDrag();
		const startX = event.clientX;
		const startY = event.clientY;
		const id = event.pointerId;
		let moved = false;
		suppressClick = false;
		const scroller = track?.parentElement;
		const move = (next: PointerEvent) => {
			if (next.pointerId !== id) return;
			const dx = next.clientX - startX;
			const dy = next.clientY - startY;
			if (!moved && Math.hypot(dx, dy) > 6) moved = true;
			if (!moved) return;
			drag = { name: pointer.name, dx, dy, over: nearest(next.clientX) };
			// Near the scroller's edge, bring the next cells into reach.
			if (scroller) {
				const box = scroller.getBoundingClientRect();
				if (next.clientX < box.left + 36) scroller.scrollLeft -= 12;
				else if (next.clientX > box.right - 36) scroller.scrollLeft += 12;
			}
		};
		const up = (next: PointerEvent) => {
			if (next.pointerId !== id) return;
			stopDrag();
			if (moved && drag) {
				suppressClick = true;
				place(pointer.name, drag.over);
				armed = null;
				focusTab(pointer.name);
			}
			drag = null;
		};
		const cancel = (next: PointerEvent) => {
			if (next.pointerId !== id) return;
			stopDrag();
			drag = null;
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
		window.addEventListener('pointercancel', cancel);
		stopDrag = () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			window.removeEventListener('pointercancel', cancel);
			stopDrag = () => {};
		};
	}

	$effect(() => () => stopDrag());

	/** A tap or Enter picks a pointer up or puts it down; the click that ends a drag does not. */
	function tabClicked(pointer: PointerView) {
		if (suppressClick) {
			suppressClick = false;
			return;
		}
		if (checked) return;
		armed = armed === pointer.name ? null : pointer.name;
		announcement = armed ? `${pointer.name} picked up. Tap a cell to put it there.` : `${pointer.name} put down.`;
	}

	function tabKey(event: KeyboardEvent, pointer: PointerView) {
		if (checked) return;
		const last = board.cells.length - 1;
		const next =
			event.key === 'ArrowRight' || event.key === 'ArrowDown'
				? Math.min(last, pointer.at + 1)
				: event.key === 'ArrowLeft' || event.key === 'ArrowUp'
					? Math.max(0, pointer.at - 1)
					: event.key === 'Home'
						? 0
						: event.key === 'End'
							? last
							: null;
		if (next === null) return;
		event.preventDefault();
		place(pointer.name, next);
		focusTab(pointer.name);
	}

	function tabName(pointer: PointerView): string {
		const parts = [`${pointer.name} pointer, at index ${pointer.at}`];
		if (pointer.tone === 'correct') parts.push('right');
		else if (pointer.tone === 'wrong') parts.push(`not right, it belongs at index ${pointer.correctAt}`);
		return parts.join(', ');
	}
</script>

{#snippet tabs()}
	<div class="layer" bind:this={layer} style:height="{height}px">
		{#each pointers as pointer, index (pointer.name)}
			{@const dragging = drag?.name === pointer.name}
			<button
				type="button"
				class="tab {pointer.tone}"
				class:armed={!checked && target === pointer.name && !lone}
				class:dragging
				data-pointer={pointer.name}
				aria-label={tabName(pointer)}
				aria-pressed={checked || lone ? undefined : armed === pointer.name}
				aria-disabled={checked || undefined}
				bind:offsetWidth={widths[pointer.name]}
				style:left="{left(centers[pointer.at] ?? 0, widths[pointer.name] ?? 40)}px"
				style:top="{rows[index]! * ROW + 6}px"
				style:translate={dragging ? `${drag!.dx}px ${drag!.dy}px` : null}
				onpointerdown={(event) => grab(event, pointer)}
				onclick={() => tabClicked(pointer)}
				onkeydown={(event) => tabKey(event, pointer)}
			>
				<span>{pointer.name}</span>
				{#if checked && pointer.tone === 'correct'}<Icon name="correct" small />{/if}
				{#if checked && pointer.tone === 'wrong'}<Icon name="missed" small />{/if}
			</button>
		{/each}
		{#each ghosts as pointer, index (pointer.name)}
			<span
				class="tab ghost"
				aria-hidden="true"
				bind:offsetWidth={ghostWidths[pointer.name]}
				style:left="{left(centers[pointer.correctAt!] ?? 0, ghostWidths[pointer.name] ?? 40)}px"
				style:top="{tabRowCount * ROW + 4 + ghostRows[index]! * GHOST_ROW}px">{pointer.name}</span
			>
		{/each}
		{#if drag}
			<!-- Where the dragged tab will land. -->
			<span class="landing" aria-hidden="true" style:left="{(centers[drag.over] ?? 0) - 22}px"></span>
		{/if}
	</div>
{/snippet}

<CellStrip
	{board}
	{name}
	selectedId={null}
	{checked}
	oncell={cellTapped}
	hint="Drag a pointer to a cell, or tap a pointer and then a cell. With a pointer focused, the arrow keys move it."
	below={tabs}
	bind:track
/>
<p class="visually-hidden" role="status">{announcement}</p>

<style>
	.layer {
		position: relative;
		margin-top: var(--space-1);
	}

	/* Each tab: a 26px tab with a caret pointing up at its cell (Pointer tab component). */
	.tab {
		position: absolute;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 26px;
		min-width: 40px;
		justify-content: center;
		padding: 0 8px;
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-control);
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
		font-family: var(--font-mono);
		font-size: 13px;
		font-weight: 500;
		line-height: 16px;
		white-space: nowrap;
		cursor: grab;
		touch-action: none;
		--caret: var(--color-border-strong);
		transition:
			border-color var(--dur-state) var(--ease),
			background-color var(--dur-state) var(--ease);
	}

	.tab::before {
		content: '';
		position: absolute;
		top: -7px;
		left: 50%;
		width: 12px;
		height: 6px;
		translate: -50% 0;
		background: var(--caret);
		clip-path: polygon(50% 0, 100% 100%, 0 100%);
	}

	/* Picked up: the Tile B outline. */
	.armed {
		border-color: var(--color-text-primary);
		box-shadow: inset 0 0 0 1px var(--color-text-primary);
		--caret: var(--color-text-primary);
	}

	.dragging {
		z-index: 2;
		cursor: grabbing;
		border-color: var(--color-text-primary);
		--caret: var(--color-text-primary);
	}

	.correct {
		background: var(--accent-tint);
		border-color: var(--accent-border);
		--caret: var(--accent-border);
	}

	.wrong {
		border-color: var(--color-status-missed);
		--caret: var(--color-status-missed);
	}

	.tab[aria-disabled='true'] {
		cursor: default;
	}

	/* Where a wrong pointer belonged: dashed, in the branch color, no caret. */
	.ghost {
		background: transparent;
		border-style: dashed;
		border-color: var(--accent);
		color: var(--accent);
		cursor: default;
	}

	.ghost::before {
		content: none;
	}

	.landing {
		position: absolute;
		top: 0;
		width: 44px;
		height: 4px;
		border-radius: 2px;
		background: var(--color-text-primary);
	}

	.tab:focus-visible {
		outline: 2px solid var(--color-focus-ring);
		outline-offset: 2px;
	}
</style>
