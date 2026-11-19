<!--
	Renders `Shape[]` geometry (glyphs.ts, branchIcons.ts) as inline SVG, so HTML rows show exactly
	what the canvas draws. Used by StatusIcon and BranchIcon; reach for those instead.
-->
<script lang="ts">
	import { svgPath, type Shape } from './glyphs';

	let { shapes, size, label }: { shapes: readonly Shape[]; size: number; label?: string } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 {size} {size}"
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
	focusable="false"
>
	{#each shapes as shape, i (i)}
		{#if shape.kind === 'text'}
			<text
				x={shape.x}
				y={shape.y}
				fill={shape.fill}
				font-size={shape.size}
				font-weight={shape.weight}
				text-anchor="middle"
				dominant-baseline="central">{shape.text}</text
			>
		{:else}
			<path
				d={svgPath(shape.segs)}
				fill={shape.fill ?? 'none'}
				stroke={shape.stroke ?? 'none'}
				stroke-width={shape.stroke ? (shape.width ?? 1) : undefined}
				stroke-linecap={shape.stroke ? (shape.cap ?? 'butt') : undefined}
				stroke-linejoin={shape.stroke ? (shape.join ?? 'miter') : undefined}
				stroke-dasharray={shape.dash ? shape.dash.join(' ') : undefined}
			/>
		{/if}
	{/each}
</svg>

<style>
	svg {
		display: block;
		flex: none;
		overflow: visible;
	}
</style>
