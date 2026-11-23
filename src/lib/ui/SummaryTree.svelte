<!--
	The summary's piece of the mastery tree (lesson Round 6, summary screen 8; Round 6b, Bleed B):
	the branch and up to two earlier lessons, ending at this lesson as a glowing leaf. Its ring has
	one segment per question, branch color when right the first time and rose when missed, around
	the score. An earlier lesson is filled with a check once mastered, and outlined until then. The
	drawing starts at the box's left edge at `scale` and runs past it, so the trunk leaves the
	screen; the screen around it clips. `t` 1 lays it flat, as under the open misses drawer
	(screen 9). The drawing is decoration: its words are in the accessible name.
-->
<script lang="ts">
	import type { LessonTrail } from '$lib/domain/trail';
	import { FLAT_HEIGHT, TREE_HEIGHT, TREE_WIDTH, ringArcs, trailLayout } from './trailGeometry';

	let {
		trail,
		results,
		width,
		scale,
		nodeScale = 1,
		t = 0
	}: {
		trail: LessonTrail;
		results: readonly boolean[];
		/** The box's width in px, which keeps the labels on screen. The screen measures it outside any scrolling box. */
		width: number;
		/** Px per drawing unit: 1 on a 390px phone. */
		scale: number;
		/** Shrinks the nodes against the spread of the path, for a large drawing on desktop. */
		nodeScale?: number;
		t?: number;
	} = $props();

	const layout = $derived(trailLayout(trail.earlier.length, t));
	const right = $derived(results.filter(Boolean).length);
	const arcs = $derived(ringArcs(layout.leaf.r - layout.leaf.ring / 2, results.length));
	const flat = $derived(t > 0.5);
	// The score is the summary's heading, so the drawing names only the path.
	const description = $derived(
		[
			...trail.earlier.map((node) => (node.kind === 'branch' ? node.title : `${node.title}${node.mastered ? ', mastered' : ', not mastered yet'}`)),
			trail.title
		].join(', then ')
	);

	const labels = $derived([
		...trail.earlier.map((node, index) => ({ text: node.title, current: false, node: layout.earlier[index]!, place: layout.earlier[index]!.label })),
		{ text: trail.title, current: true, node: layout.leaf, place: layout.leaf.label }
	]);
	let widths = $state<number[]>([]);
	let heights = $state<number[]>([]);

	/** Left and top in px, kept 6px inside the box so a long label never leaves the screen. */
	function position(index: number) {
		const { node, place } = labels[index]!;
		const w = widths[index] ?? 0;
		const h = heights[index] ?? 0;
		// A label's gap from its node shrinks with the node.
		const x = node.x + (place.x - node.x) * nodeScale;
		const y = node.y + (place.y - node.y) * nodeScale;
		const anchor = place.align === 'start' ? 0 : place.align === 'end' ? 1 : 0.5;
		const left = Math.max(6, Math.min(width - 6 - w, x * scale - anchor * w));
		const top = place.below ? y * scale : y * scale - h / 2;
		return { left: `${left}px`, top: `${top}px` };
	}
</script>

<div
	class="tree"
	class:flat
	role="img"
	aria-label={description}
	style:width="{width}px"
	style:height="{(flat ? FLAT_HEIGHT : TREE_HEIGHT) * scale}px"
>
	<svg viewBox="0 0 {TREE_WIDTH} {TREE_HEIGHT}" width={TREE_WIDTH * scale} height={TREE_HEIGHT * scale} aria-hidden="true">
		<defs>
			<radialGradient id="leaf-glow">
				<stop offset="0" class="glow-stop" stop-opacity="0.28" />
				<stop offset="1" class="glow-stop" stop-opacity="0" />
			</radialGradient>
		</defs>
		{#if layout.trunk}<path class="trunk" d={layout.trunk} />{/if}
		{#each layout.edges as edge, index (index)}<path class="edge" d={edge} />{/each}
		{#each trail.earlier as node, index (node.id)}
			{@const placed = layout.earlier[index]!}
			<g transform="translate({placed.x} {placed.y}) scale({placed.scale * nodeScale})">
				{#if node.kind === 'branch'}
					<circle class="hollow" r="17" />
					<path class="branch-mark" d="M-8 -2h16v7h-16z M-2.7 -2v7 M2.7 -2v7" />
					<path class="branch-flag" d="M-2.5 -7h5l-2.5 3z" />
				{:else if node.mastered}
					<circle class="filled" r="20" />
					<path class="check" d="M-6 0l4 4 8-8" />
				{:else}
					<circle class="hollow" r="19" />
				{/if}
			</g>
		{/each}
		<g transform="translate({layout.leaf.x} {layout.leaf.y}) scale({nodeScale})">
			<circle r={layout.leaf.r * 2.1} fill="url(#leaf-glow)" />
			<circle class="core" r={layout.leaf.r - layout.leaf.ring} />
			{#each arcs as arc, index (index)}<path class="segment" class:missed={!results[index]} d={arc} stroke-width={layout.leaf.ring} />{/each}
			<text class="score" text-anchor="middle" dominant-baseline="central" font-size={layout.leaf.score}>{right} of {results.length}</text>
		</g>
	</svg>
	{#each labels as label, index (index)}
		<span
			class="label"
			class:current={label.current}
			class:wrap={flat}
			aria-hidden="true"
			bind:offsetWidth={widths[index]}
			bind:offsetHeight={heights[index]}
			style:left={position(index).left}
			style:top={position(index).top}>{label.text}</span
		>
	{/each}
</div>

<style>
	.tree {
		position: relative;
		flex: none;
	}

	svg {
		position: absolute;
		top: 0;
		left: 0;
		overflow: visible;
	}

	.trunk {
		fill: none;
		stroke: var(--color-border-strong);
		stroke-width: 2;
		stroke-linecap: round;
		opacity: 0.6;
	}

	.edge {
		fill: none;
		stroke: var(--accent);
		stroke-width: 2;
		stroke-linecap: round;
		opacity: 0.8;
	}

	.hollow {
		fill: var(--color-surface-card);
		stroke: var(--accent);
		stroke-width: 2;
	}

	.branch-mark {
		fill: none;
		stroke: var(--accent);
		stroke-width: 1.4;
	}

	.branch-flag {
		fill: var(--accent);
	}

	.filled {
		fill: var(--accent);
	}

	.check {
		fill: none;
		stroke: var(--color-surface-page);
		stroke-width: 2.4;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.glow-stop {
		stop-color: var(--accent);
	}

	.core {
		fill: var(--color-surface-card);
	}

	.segment {
		fill: none;
		stroke: var(--accent);
	}

	.segment.missed {
		stroke: var(--color-status-missed);
	}

	.score {
		fill: var(--color-text-primary);
		font-family: var(--font-sans);
		font-weight: 600;
	}

	/* Sizes from the summary: 14 and 16 on a phone, larger on desktop. */
	.label {
		position: absolute;
		color: var(--color-text-secondary);
		font-size: var(--trail-label-size, 14px);
		line-height: var(--trail-label-line, 20px);
		font-weight: 500;
		white-space: nowrap;
	}

	.label.current {
		color: var(--color-text-primary);
		font-size: var(--trail-current-size, 16px);
		line-height: var(--trail-current-line, 24px);
		font-weight: 600;
	}

	/* Flat, every label hangs centered under its node and may wrap once. */
	.label.wrap {
		width: 96px;
		white-space: normal;
		text-align: center;
	}
</style>
