<!--
	The lesson summary (lesson Round 6, screens 8 and 9): "Lesson complete" in the top bar, the tree
	piece ending at this lesson's ring, the misses, then Done and Retry. When the misses would need
	to scroll, they become a drawer over the tree: drag its handle up, tap it or press Enter, and it
	opens and the tree lies flat; drag down, tap again or press Escape to close. The drawer's motion
	(drift while dragging, the tree's flatten) is the motion pass's.
-->
<script lang="ts">
	import type { Summary } from '$lib/domain/lesson';
	import type { LessonTrail } from '$lib/domain/trail';
	import Button from './Button.svelte';
	import LessonFooter from './LessonFooter.svelte';
	import LessonTopBar from './LessonTopBar.svelte';
	import MissList from './MissList.svelte';
	import SummaryTree from './SummaryTree.svelte';
	import { FLAT_HEIGHT, TREE_HEIGHT, TREE_WIDTH } from './trailGeometry';

	let { summary, trail, ondone, onretry }: { summary: Summary; trail: LessonTrail; ondone: () => void; onretry: () => void } = $props();

	let heading: HTMLElement;
	$effect(() => heading.focus());

	// Sizes that decide whether the misses fit under the tree or need the drawer.
	let bodyHeight = $state(0);
	let contentWidth = $state(TREE_WIDTH);
	let listHeight = $state(0);
	const treeWidth = $derived(Math.min(contentWidth, 360));
	const scale = $derived(treeWidth / TREE_WIDTH);
	// The tree sits 8px below the body's top edge (its wrap's padding).
	const closedTop = $derived(8 + TREE_HEIGHT * scale);
	const openTop = $derived(8 + FLAT_HEIGHT * scale);
	// A drawer needs room to show at least a row closed; a screen shorter than that just scrolls.
	// The card adds 28px above the list and 16px below it.
	const cardHeight = $derived(listHeight + 44);
	const drawer = $derived(summary.missed.length > 0 && cardHeight > bodyHeight - closedTop && bodyHeight - closedTop >= 96);
	// Too short for the drawer, the body scrolls instead, and takes focus so the keyboard can scroll it.
	const scrolls = $derived(!drawer && closedTop + cardHeight > bodyHeight);

	let open = $state(false);
	let dragTop = $state<number | null>(null);
	const top = $derived(dragTop ?? (open ? openTop : closedTop));

	let grab: HTMLButtonElement | undefined = $state();
	let dragged = false;
	let stopDrag = () => {};

	// The drag listens on the window, so it follows the finger past the handle and where WebKit
	// refuses pointer capture.
	function grabDown(event: PointerEvent) {
		if (event.button > 0) return;
		stopDrag();
		const startY = event.clientY;
		const startTop = top;
		const id = event.pointerId;
		dragged = false;
		const move = (next: PointerEvent) => {
			if (next.pointerId !== id) return;
			const dy = next.clientY - startY;
			if (Math.abs(dy) > 6) dragged = true;
			if (dragged) dragTop = Math.min(closedTop, Math.max(openTop, startTop + dy));
		};
		const up = (next: PointerEvent) => {
			if (next.pointerId !== id) return;
			stopDrag();
			if (dragged && dragTop !== null) open = (closedTop - dragTop) / (closedTop - openTop) > 0.5;
			dragTop = null;
		};
		// A canceled drag snaps back, and since no click follows it, the next tap must not be skipped.
		const cancel = (next: PointerEvent) => {
			if (next.pointerId !== id) return;
			stopDrag();
			dragged = false;
			dragTop = null;
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

	/** A tap or Enter toggles; the click that ends a drag does not. */
	function grabClick() {
		if (dragged) {
			dragged = false;
			return;
		}
		open = !open;
	}

	// On the window, since Safari does not focus a button it clicks.
	function drawerKey(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !open || !drawer) return;
		event.preventDefault();
		open = false;
		grab?.focus();
	}
</script>

<svelte:window onkeydown={drawerKey} />

<div class="summary">
	<div class="top">
		<div class="column">
			<LessonTopBar title="Lesson complete" quitLabel="Close" onquit={ondone} />
			<!-- The tree's width is measured here, outside the scrolling body: a scrollbar coming or
			     going there would change the width, which sets the tree's height, which decides
			     whether the scrollbar is needed. -->
			<div bind:clientWidth={contentWidth}></div>
		</div>
	</div>

	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<main class="column body" class:drawer bind:clientHeight={bodyHeight} tabindex={scrolls ? 0 : undefined}>
		<h1 class="visually-hidden" tabindex="-1" bind:this={heading}>{summary.correctFirstTry} of {summary.total} right the first time</h1>
		<div class="tree-wrap">
			<SummaryTree {trail} results={summary.results} width={treeWidth} t={drawer && open ? 1 : 0} />
		</div>
		{#if summary.missed.length > 0}
			<!-- One list in both modes, so its measured height never drops out when the drawer turns on.
		     The handle shows only when the card can open further. -->
			<section class="misses" class:sheet={drawer} class:open={drawer && open} style:top={drawer ? `${top}px` : null} aria-label="Missed questions">
				{#if drawer}
					<button
						type="button"
						class="grab"
						aria-label="Missed questions"
						aria-expanded={open}
						aria-controls="summary-misses"
						bind:this={grab}
						onpointerdown={grabDown}
						onclick={grabClick}
					>
						<span class="grabber" aria-hidden="true"></span>
					</button>
				{/if}
				<!-- Open, the list scrolls, so it takes focus for keyboard scrolling. -->
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<div class="scroll" tabindex={drawer && open ? 0 : undefined}>
					<div bind:clientHeight={listHeight}><MissList id="summary-misses" misses={summary.missed} /></div>
				</div>
			</section>
		{/if}
	</main>

	<LessonFooter>
		<Button onclick={ondone}>Done</Button>
		<Button variant="secondary" onclick={onretry}>Retry</Button>
	</LessonFooter>
</div>

<style>
	/* The screen fits the viewport, so the misses either fit under the tree or move into the drawer. */
	.summary {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		background: var(--color-surface-page);
		color: var(--color-text-primary);
		font-family: var(--font-sans);
	}

	.column {
		width: 100%;
		max-width: 672px;
		margin: 0 auto;
		padding: 0 var(--space-screen-edge);
	}

	.top {
		flex: none;
		padding-top: max(var(--space-4), env(safe-area-inset-top));
		padding-bottom: var(--space-2);
	}

	.body {
		position: relative;
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		overflow: hidden auto;
	}

	.body.drawer {
		overflow: hidden;
	}

	.body:focus-visible,
	.sheet .scroll:focus-visible {
		outline: 2px solid var(--color-focus-ring);
		outline-offset: -2px;
	}

	.tree-wrap {
		flex: none;
		padding-top: var(--space-2);
	}

	/* The misses always sit on the drawer's raised card, reaching down to the footer and out to the
	   column's edges. Without the handle, the same 28px stays above the first row. */
	.misses {
		flex: 1 0 auto;
		display: flex;
		flex-direction: column;
		margin: 0 calc(-1 * var(--space-screen-edge));
		padding: 28px var(--space-screen-edge) var(--space-4);
		background: var(--color-surface-card);
		border: 1px solid var(--color-border-default);
		border-bottom: 0;
		border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
	}

	.sheet {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		margin: 0;
		padding-top: 0;
		padding-bottom: 0;
	}

	.grab {
		flex: none;
		display: grid;
		place-items: center;
		height: 28px;
		border: 0;
		background: none;
		cursor: grab;
		touch-action: none;
		border-radius: var(--radius-control);
	}

	.grab:focus-visible {
		outline: 2px solid var(--color-focus-ring);
		outline-offset: -2px;
	}

	.grabber {
		width: 36px;
		height: 4px;
		border-radius: 2px;
		background: var(--color-border-strong);
	}

	.sheet .scroll {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.sheet.open .scroll {
		overflow-y: auto;
	}

	h1:focus {
		outline: none;
	}
</style>
