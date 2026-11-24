<!--
	The lesson summary (lesson Round 6, screens 8 and 9; Round 6b): "Lesson complete" in the top bar,
	the tree piece ending at this lesson's ring, the misses on a raised Night card, then Done and
	Retry.
	Phone (Bleed B): the tree is drawn 1.3x from the screen's left edge, and its trunk runs off the
	left and bottom edges. When the misses would need to scroll, their card becomes a drawer over the
	tree: drag its handle up, tap it or press Enter, and it opens and the tree lies flat; drag down,
	tap again or press Escape to close. The handle shows only then. The drawer's motion is the
	motion pass's.
	Desktop, from 1024px (Desktop A, Split): the tree fills the left, large, running off the left
	and bottom edges; the misses card and Done and Retry sit on the right. No drawer: the card
	scrolls when it must.
-->
<script lang="ts">
	import type { Summary } from '$lib/domain/lesson';
	import type { LessonTrail } from '$lib/domain/trail';
	import Button from './Button.svelte';
	import LessonTopBar from './LessonTopBar.svelte';
	import MissList from './MissList.svelte';
	import SummaryTree from './SummaryTree.svelte';
	import { shift, summaryTimeline, tween } from './motion';
	import { MOTION } from './tokens';
	import { TREE_HEIGHT, TREE_WIDTH, treeBoxHeight } from './trailGeometry';

	let { summary, trail, ondone, onretry }: { summary: Summary; trail: LessonTrail; ondone: () => void; onretry: () => void } = $props();

	let heading: HTMLElement;
	$effect(() => heading.focus());

	const DESKTOP = '(min-width: 1024px)';
	let desktop = $state(typeof matchMedia === 'function' && matchMedia(DESKTOP).matches);
	$effect(() => {
		const query = matchMedia(DESKTOP);
		const update = () => (desktop = query.matches);
		update();
		query.addEventListener('change', update);
		return () => query.removeEventListener('change', update);
	});

	// Sizes. None is measured inside a box whose scrollbar it could toggle: the phone tree follows
	// the window, and the desktop tree its grid cell, which does not scroll.
	let innerWidth = $state(TREE_WIDTH);
	let cellWidth = $state(0);
	let cellHeight = $state(0);
	let bodyHeight = $state(0);
	let listHeight = $state(0);
	let cardHeight = $state(0);

	const treeWidth = $derived(desktop ? cellWidth : innerWidth);
	const scale = $derived(
		desktop ? Math.max(0.5, Math.min(cellWidth / TREE_WIDTH, cellHeight / TREE_HEIGHT, 2.2)) : Math.min(innerWidth / TREE_WIDTH, 1.25)
	);
	// The tree sits 8px below the body's top edge on a phone.
	// The body starts at the top of the screen, under the header, so the leaf's glow is never cut by
	// a box edge; its content starts below the header, and the tree 8px below that.
	let headerHeight = $state(0);
	const closedTop = $derived(headerHeight + 8 + treeBoxHeight(false, scale));
	const openTop = $derived(headerHeight + 8 + treeBoxHeight(true, scale));
	// The card adds 28px above the list and 16px below it. A drawer needs room to show a row closed;
	// a phone shorter than that scrolls the body instead.
	const cardNeeds = $derived(listHeight + 44);
	const drawer = $derived(!desktop && summary.missed.length > 0 && cardNeeds > bodyHeight - closedTop && bodyHeight - closedTop >= 96);
	// Whatever scrolls takes focus, so the keyboard can scroll it.
	const bodyScrolls = $derived(!desktop && !drawer && closedTop + cardNeeds > bodyHeight);
	const cardScrolls = $derived(desktop && cardNeeds > cardHeight);

	let open = $state(false);
	let dragTop = $state<number | null>(null);
	const top = $derived(dragTop ?? (open ? openTop : closedTop));

	// The tree's shape, 0 curved to 1 flat (Round 7). While dragging it drifts up to 10% toward flat
	// (stage 1); snapped open it flattens over 250ms, and closing runs that back (stage 2). With
	// Reduce effects there is no drift and stage 2 crossfades: the tree fades out, changes, fades in.
	const DRIFT = 0.1;
	let t = $state(0);
	let faded = $state(false);
	let morphing = false;
	let stopMorph = () => {};

	function morphTo(target: number) {
		stopMorph();
		if (shift() === 0) {
			faded = true;
			const timer = setTimeout(() => {
				t = target;
				faded = false;
			}, MOTION.duration.morph / 2);
			stopMorph = () => clearTimeout(timer);
			return;
		}
		const from = t;
		morphing = true;
		stopMorph = tween(
			MOTION.duration.morph,
			(progress) => (t = from + (target - from) * progress),
			() => (morphing = false)
		);
	}

	function setOpen(next: boolean) {
		open = next;
		morphTo(next ? 1 : 0);
	}

	// A phone turned or resized out of drawer mode starts over, closed, curved and shown, even mid
	// crossfade: the tree must never be left faded out.
	$effect(() => {
		if (drawer) return;
		stopMorph();
		morphing = false;
		faded = false;
		open = false;
		t = 0;
	});

	$effect(() => () => stopMorph());

	const timeline = $derived(summaryTimeline(trail.earlier.length, summary.results.length));

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
		// Leaving the open drawer, the flatten runs back to the drift first.
		if (open && shift() === 1) morphTo(DRIFT);
		const move = (next: PointerEvent) => {
			if (next.pointerId !== id) return;
			const dy = next.clientY - startY;
			if (Math.abs(dy) > 6) dragged = true;
			if (!dragged) return;
			dragTop = Math.min(closedTop, Math.max(openTop, startTop + dy));
			if (!morphing && shift() === 1) t = DRIFT * ((closedTop - dragTop) / (closedTop - openTop));
		};
		const up = (next: PointerEvent) => {
			if (next.pointerId !== id) return;
			stopDrag();
			if (dragged && dragTop !== null) setOpen((closedTop - dragTop) / (closedTop - openTop) > 0.5);
			dragTop = null;
		};
		// A canceled drag snaps back, and since no click follows it, the next tap must not be skipped.
		const cancel = (next: PointerEvent) => {
			if (next.pointerId !== id) return;
			stopDrag();
			dragged = false;
			dragTop = null;
			morphTo(open ? 1 : 0);
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
		setOpen(!open);
	}

	// On the window, since Safari does not focus a button it clicks.
	function drawerKey(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !open || !drawer) return;
		event.preventDefault();
		setOpen(false);
		grab?.focus();
	}
</script>

<svelte:window onkeydown={drawerKey} bind:innerWidth />

<div class="summary" class:desktop>
	<div class="top" bind:offsetHeight={headerHeight}>
		<div class="column"><LessonTopBar title="Lesson complete" quitLabel="Close" onquit={ondone} /></div>
	</div>

	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<main class="body" class:drawer bind:clientHeight={bodyHeight} tabindex={bodyScrolls ? 0 : undefined} style:padding-top="{desktop ? 0 : headerHeight}px">
		<h1 class="visually-hidden" tabindex="-1" bind:this={heading}>{summary.correctFirstTry} of {summary.total} right the first time</h1>
		<div class="tree-wrap" class:faded bind:clientWidth={cellWidth} bind:clientHeight={cellHeight}>
			<!-- On desktop the path spreads over the left half while the nodes stay near their 1.5x design size. -->
			<SummaryTree {trail} results={summary.results} width={treeWidth} {scale} nodeScale={desktop ? 0.6 : 1} t={drawer ? t : 0} />
		</div>
		{#if summary.missed.length > 0}
			<!-- One list in every mode, so its measured height never drops out when the drawer turns on. -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<section
				class="misses"
				class:sheet={drawer}
				class:dragging={dragTop !== null}
				style:--delay="{timeline.misses}ms"
				class:open={drawer && open}
				style:top={drawer ? `${top}px` : null}
				aria-label="Missed questions"
				bind:clientHeight={cardHeight}
				tabindex={cardScrolls ? 0 : undefined}
			>
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

	<footer class="actions">
		<div class="buttons">
			<Button onclick={ondone}>Done</Button>
			<Button variant="secondary" onclick={onretry}>Retry</Button>
		</div>
	</footer>
</div>

<style>
	/* The screen fits the viewport, so the misses either fit under the tree or move into the drawer. */
	.summary {
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100dvh;
		overflow: hidden;
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

	/* The header lies over the top of the body, transparent, so the tree's glow can rise behind it;
	   only the screen edge ever cuts the drawing. */
	.top {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 2;
		padding-top: max(var(--space-4), env(safe-area-inset-top));
		padding-bottom: var(--space-2);
		pointer-events: none;
	}

	.top :global(button) {
		pointer-events: auto;
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
	.misses:focus-visible,
	.sheet .scroll:focus-visible {
		outline: 2px solid var(--color-focus-ring);
		outline-offset: -2px;
	}

	/* Full bleed: the body spans the screen, so the tree reaches the screen's edges and the drawing
	   runs past them. Nothing between the tree and the screen clips it. */
	.tree-wrap {
		flex: none;
		width: 100%;
		padding-top: var(--space-2);
	}

	/* The tree's crossfade under Reduce effects: out and back in, half the morph each way. */
	.tree-wrap {
		transition: opacity calc(var(--dur-morph) / 2) var(--ease);
	}

	.tree-wrap.faded {
		opacity: 0;
	}

	/* Arrival: the misses rise 8px and fade in after the ring's last segment (Round 7). The rise is
	   on `translate`, so it composes with the drawer's centering transform. */
	.misses {
		animation: rise var(--dur-state) var(--ease) backwards;
		animation-delay: calc(var(--delay, 0ms) * var(--shift));
	}

	@keyframes rise {
		from {
			opacity: 0;
			translate: 0 calc(8px * var(--shift));
		}
	}

	/* The drawer snaps to open or closed in 150ms; with Reduce effects it moves at once. Dragging,
	   it follows the finger. */
	.sheet:not(.dragging) {
		transition: top calc(var(--dur-state) * var(--shift)) var(--ease);
	}

	/* Every misses list sits on the drawer's raised card, reaching down to the footer and out to the
	   column's edges. Without the handle, the same 28px stays above the first row. */
	.misses {
		flex: 1 0 auto;
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 672px;
		margin: 0 auto;
		padding: 28px var(--space-screen-edge) var(--space-4);
		background: var(--color-surface-card);
		border: 1px solid var(--color-border-default);
		border-bottom: 0;
		border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
	}

	.sheet {
		position: absolute;
		left: 50%;
		bottom: 0;
		transform: translateX(-50%);
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

	/* The footer strip, as on the lesson screen: pinned, with a Twilight top edge. */
	.actions {
		flex: none;
		border-top: 1px solid var(--color-border-default);
		background: var(--color-surface-page);
		padding: var(--space-4) var(--space-screen-edge) max(var(--space-4), env(safe-area-inset-bottom));
	}

	.buttons {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		max-width: 640px;
		margin: 0 auto;
	}

	/* Desktop A, Split: tree on the left, running off the left and bottom edges; misses card and
	   actions on the right. */
	.summary.desktop {
		display: grid;
		grid-template-columns: 1fr minmax(420px, 540px);
		grid-template-rows: auto 1fr auto;
		column-gap: 40px;
		padding-right: 40px;
		--trail-label-size: 16px;
		--trail-label-line: 24px;
		--trail-current-size: 20px;
		--trail-current-line: 28px;
	}

	.desktop .top {
		position: relative;
		grid-column: 1 / -1;
		padding: 40px 0 var(--space-6) 40px;
	}

	.desktop .top .column {
		max-width: none;
		padding: 0;
	}

	.desktop .body {
		display: contents;
	}

	.desktop .tree-wrap {
		grid-column: 1;
		grid-row: 2 / 4;
		width: auto;
		margin: 0;
		padding: 0;
		display: flex;
		align-items: flex-end;
		min-height: 0;
	}

	.desktop .misses {
		grid-column: 2;
		grid-row: 2;
		min-height: 0;
		max-width: none;
		margin: 0;
		padding: var(--space-3) var(--space-6);
		border-bottom: 1px solid var(--color-border-default);
		border-radius: var(--radius-sheet);
		overflow-y: auto;
		align-self: start;
		max-height: 100%;
	}

	.desktop .actions {
		grid-column: 2;
		grid-row: 3;
		border-top: 0;
		padding: var(--space-6) 0 40px;
	}

	.desktop .buttons {
		flex-direction: row;
		max-width: none;
	}

	.desktop .buttons > :global(*) {
		flex: 1;
	}
</style>
