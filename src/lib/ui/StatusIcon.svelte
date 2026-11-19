<!--
	A status glyph as inline SVG, from the same geometry the tree canvas draws (glyphs.ts). The shape
	carries the status, so by default it is announced as an image named by its status ("Done",
	"Locked"). Pass `label=""` to hide it when nearby text already says the status.
-->
<script lang="ts">
	import { glyphShapes, statusLabel, type CheckpointState, type GlyphKind, type NodeState } from './glyphs';
	import { COLORS } from './palette';
	import Shapes from './Shapes.svelte';

	let {
		kind,
		state,
		color = COLORS.gold,
		size = 30,
		due = 0,
		mastered = 0,
		total = 0,
		label
	}: {
		kind: GlyphKind;
		state: NodeState | CheckpointState;
		/** Branch color as `#rrggbb`. */
		color?: string;
		/** Box size in CSS pixels. The glyph keeps the tree mock's row proportions (radius 9.5 in 30). */
		size?: number;
		/** Due review cards: draws the rose badge. */
		due?: number;
		/** A path's progress ring. */
		mastered?: number;
		total?: number;
		/** Accessible name. Defaults to the status words; an empty string hides the icon from screen readers. */
		label?: string;
	} = $props();

	const shapes = $derived.by(() => {
		const r = ((kind === 'checkpoint' ? 9 : 9.5) * size) / 30;
		const c = size / 2;
		return glyphShapes(kind as 'skill', c, c, r, state as NodeState, color, { due, mastered, total });
	});
</script>

<Shapes {shapes} {size} label={label ?? statusLabel(kind, state)} />
