<!--
	The summary's piece of the mastery tree (lesson Round 6, summary screen 8): the branch and up to
	two earlier lessons, ending at this lesson as a glowing leaf. Its ring has one segment per
	question, branch color when right the first time and rose when missed, around the score. An
	earlier lesson is filled with a check once mastered, and outlined until then. `t` 1 lays it
	flat, as under the open misses drawer (screen 9). The drawing is decoration: its words are in
	the accessible name.
-->
<script lang="ts">
	import type { LessonTrail } from '$lib/domain/trail';
	import { FLAT_HEIGHT, TREE_HEIGHT, TREE_WIDTH, ringArcs, trailLayout } from './trailGeometry';

	let {
		trail,
		results,
		width,
		t = 0
	}: {
		trail: LessonTrail;
		results: readonly boolean[];
		/** Drawn width in px, at most 360. The screen measures it outside any scrolling box. */
		width: number;
		t?: number;
	} = $props();

	const layout = $derived(trailLayout(trail.earlier.length, t));
	const right = $derived(results.filter(Boolean).length);
	const arcs = $derived(ringArcs(layout.leaf.r - 3, results.length));
	const flat = $derived(t > 0.5);
	// The score is the summary's heading, so the drawing names only the path.
	const description = $derived(
		[
			...trail.earlier.map((node) => (node.kind === 'branch' ? node.title : `${node.title}${node.mastered ? ', mastered' : ', not mastered yet'}`)),
			trail.title
		].join(', then ')
	);

	const scale = $derived(width / TREE_WIDTH);
	const labels = $derived([
		...trail.earlier.map((node, index) => ({ text: node.title, current: false, place: layout.earlier[index]!.label })),
		{ text: trail.title, current: true, place: layout.leaf.label }
	]);
	let widths = $state<number[]>([]);
	let heights = $state<number[]>([]);

	/** Left and top in px, kept 6px inside the box so a long label never leaves the screen. */
	function position(index: number) {
		const { place } = labels[index]!;
		const w = widths[index] ?? 0;
		const h = heights[index] ?? 0;
		const anchor = place.align === 'start' ? 0 : place.align === 'end' ? 1 : 0.5;
		const left = Math.max(6, Math.min(width - 6 - w, place.x * scale - anchor * w));
		const top = place.below ? place.y * scale : place.y * scale - h / 2;
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
	<svg viewBox="0 0 {TREE_WIDTH} {TREE_HEIGHT}" aria-hidden="true">
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
			<g transform="translate({placed.x} {placed.y}) scale({placed.scale})">
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
		<g transform="translate({layout.leaf.x} {layout.leaf.y})">
			<circle r={layout.leaf.r * 2.1} fill="url(#leaf-glow)" />
			<circle class="core" r={layout.leaf.r - 4} />
			{#each arcs as arc, index (index)}<path class="segment" class:missed={!results[index]} d={arc} />{/each}
			<text class="score" text-anchor="middle" dominant-baseline="central" font-size={flat ? 13 : 14}>{right} of {results.length}</text>
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
		margin: 0 auto;
		flex: none;
	}

	svg {
		position: absolute;
		inset: 0 0 auto;
		width: 100%;
		height: auto;
		aspect-ratio: 340 / 320;
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
		stroke-width: 6;
	}

	.segment.missed {
		stroke: var(--color-status-missed);
	}

	.score {
		fill: var(--color-text-primary);
		font-family: var(--font-sans);
		font-weight: 600;
	}

	.label {
		position: absolute;
		color: var(--color-text-secondary);
		font-size: 13px;
		line-height: 18px;
		font-weight: 500;
		white-space: nowrap;
	}

	.label.current {
		color: var(--color-text-primary);
		font-size: 15px;
		line-height: 20px;
		font-weight: 600;
	}

	/* Flat, every label hangs centered under its node and may wrap once. */
	.label.wrap {
		width: 96px;
		white-space: normal;
		text-align: center;
	}
</style>
