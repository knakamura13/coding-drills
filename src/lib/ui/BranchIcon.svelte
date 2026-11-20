<!--
	A curriculum branch's line icon as inline SVG, from the same geometry the canvas draws
	(branchIcons.ts). Decorative by default; pass `label` when nothing nearby names the branch.
-->
<script lang="ts">
	import { branchIconShapes } from './branchIcons';
	import { branchColor } from './palette';
	import Shapes from './Shapes.svelte';

	let { id, color, size = 24, label }: { id: string; color?: string; size?: number; label?: string } = $props();

	// The widest icon spans 1.8u plus its stroke, so u = 0.42 * size keeps every icon inside the box.
	const shapes = $derived(branchIconShapes(id, size / 2, size / 2, size * 0.42, color ?? branchColor(id)));
</script>

<Shapes {shapes} {size} {label} />
