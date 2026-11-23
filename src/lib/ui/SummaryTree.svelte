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
	import { placeLabels, type Side } from './labelPlacement';
	import { LABEL_FORMS, TREE_HEIGHT, TREE_WIDTH, curvePath, fitLeaf, labelScene, ringArcs, trailLayout, treeBoxHeight } from './trailGeometry';

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

	const right = $derived(results.filter(Boolean).length);
	const layout = $derived(fitLeaf(trailLayout(trail.earlier.length, t), scale * nodeScale, `${right} of ${results.length}`));
	const arcs = $derived(ringArcs(layout.leaf.r - layout.leaf.ring / 2, results.length));
	const flat = $derived(t > 0.5);
	// The score is the summary's heading, so the drawing names only the path.
	const description = $derived(
		[
			...trail.earlier.map((node) => (node.kind === 'branch' ? node.title : `${node.title}${node.mastered ? ', mastered' : ', not mastered yet'}`)),
			trail.title
		].join(', then ')
	);

	const boxHeight = $derived(treeBoxHeight(flat, scale));
	const texts = $derived([...trail.earlier.map((node) => node.title), trail.title]);

	// Each label is measured unseen in every form, then placed where it clears every node, edge and
	// other label and stays in the box.
	let formWidths = $state<number[][]>(LABEL_FORMS.map(() => []));
	let formHeights = $state<number[][]>(LABEL_FORMS.map(() => []));
	const placements = $derived.by(() => {
		const scene = labelScene(layout, { scale, nodeScale, width, flat }, (index, form) => {
			const f = LABEL_FORMS.indexOf(form);
			return { w: formWidths[f]![index] ?? 0, h: formHeights[f]![index] ?? 0 };
		});
		return placeLabels(scene.requests, scene.obstacles, scene.box);
	});
	const ALIGN: Record<Side, string> = { right: 'left', left: 'right', below: 'center', lower: 'center', above: 'center' };
</script>

<div
	class="tree"
	class:flat
	role="img"
	aria-label={description}
	style:width="{width}px"
	style:height="{boxHeight}px"
>
	<svg viewBox="0 0 {TREE_WIDTH} {TREE_HEIGHT}" width={TREE_WIDTH * scale} height={TREE_HEIGHT * scale} aria-hidden="true">
		<defs>
			<radialGradient id="leaf-glow">
				<stop offset="0" class="glow-stop" stop-opacity="0.28" />
				<stop offset="1" class="glow-stop" stop-opacity="0" />
			</radialGradient>
		</defs>
		{#if layout.trunk}<path class="trunk" d={curvePath(layout.trunk)} />{/if}
		{#each layout.edges as edge, index (index)}<path class="edge" d={curvePath(edge)} />{/each}
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
			<!-- Opaque under the ring, so the edge that runs to the leaf's center never shows in a ring gap. -->
			<circle class="ring-base" r={layout.leaf.r} />
			<circle class="core" r={layout.leaf.r - layout.leaf.ring} />
			{#each arcs as arc, index (index)}<path class="segment" class:missed={!results[index]} d={arc} stroke-width={layout.leaf.ring} />{/each}
			<text class="score" text-anchor="middle" dominant-baseline="central" font-size={layout.leaf.score}>{right} of {results.length}</text>
		</g>
	</svg>
	{#each texts as text, index (index)}
		{@const place = placements[index]}
		<!-- Measured unseen in every form, for the placement. -->
		{#each LABEL_FORMS as form, f (f)}
			<span
				class="label measure"
				class:current={index === texts.length - 1}
				class:wrap={form.wrap !== null}
				class:small={form.small}
				style:max-width={form.wrap === null ? null : `${form.wrap}px`}
				aria-hidden="true"
				bind:offsetWidth={formWidths[f]![index]}
				bind:offsetHeight={formHeights[f]![index]}>{text}</span
			>
		{/each}
		<!-- A label with no clear spot is left out of the drawing; the accessible name still has it. -->
		{#if place}
			<span
				class="label"
				class:current={index === texts.length - 1}
				class:wrap={place.wrap !== null}
				class:small={place.small}
				aria-hidden="true"
				style:left="{place.x}px"
				style:top="{place.y}px"
				style:width="{place.w}px"
				style:text-align={ALIGN[place.side]}>{text}</span
			>
		{/if}
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

	.ring-base {
		fill: var(--color-surface-page);
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

	/* The fallback forms, used where one line has no clear spot: wrapped narrower, with
	   balanced lines so no word is left alone, and a smaller size. */
	.label.wrap {
		white-space: normal;
		text-wrap: balance;
	}

	.label.small {
		font-size: calc(var(--trail-label-size, 14px) - 1px);
		line-height: calc(var(--trail-label-line, 20px) - 2px);
	}

	.label.current.small {
		font-size: calc(var(--trail-current-size, 16px) - 1px);
		line-height: calc(var(--trail-current-line, 24px) - 2px);
	}

	/* Flat, under the open drawer, the labels are a size smaller so they fit under their nodes. */
	.flat .label {
		font-size: 12px;
		line-height: 16px;
	}

	.flat .label.current {
		font-size: 13px;
		line-height: 18px;
	}

	.flat .label.small {
		font-size: 11px;
		line-height: 14px;
	}

	.flat .label.current.small {
		font-size: 12px;
		line-height: 16px;
	}

	.label.measure {
		visibility: hidden;
		left: 0;
		top: 0;
	}

	.label.measure.wrap {
		width: max-content;
	}
</style>
