<!--
	The lesson icons from the FigCraft Components page. Decorative by default; pass `label` when the
	icon carries meaning no nearby text gives. Colors follow the screen's branch through --accent.
	`small` draws the 12px result badges that sit in a cell's corner.
-->
<script lang="ts" module>
	export type IconName = 'close' | 'correct' | 'missed' | 'chevron-down';
</script>

<script lang="ts">
	let { name, small = false, label }: { name: IconName; small?: boolean; label?: string } = $props();

	const size = $derived(name === 'close' ? 24 : name === 'chevron-down' ? 20 : small ? 12 : 16);
</script>

<svg
	class="icon {name}"
	class:small
	width={size}
	height={size}
	viewBox="0 0 {size} {size}"
	fill="none"
	role={label ? 'img' : undefined}
	aria-label={label || undefined}
	aria-hidden={label ? undefined : 'true'}
>
	{#if name === 'close'}
		<path d="M6 6 L18 18 M18 6 L6 18" stroke-width="2" stroke-linecap="round" />
	{:else if name === 'chevron-down'}
		<path d="M5 7.5 L10 12.5 L15 7.5" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
	{:else if small}
		<circle class="disc" cx="6" cy="6" r="5.4" stroke-width="1.25" />
		{#if name === 'correct'}
			<path d="M3.75 6.2 L5.3 7.8 L8.25 4.65" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
		{:else}
			<path d="M6 3.3 L6 6.7" stroke-width="1.25" stroke-linecap="round" />
			<circle class="dot" cx="6" cy="8.55" r="0.7" />
		{/if}
	{:else}
		<circle cx="8" cy="8" r="7.25" stroke-width="1.5" />
		{#if name === 'correct'}
			<path d="M5 8.3 L7.1 10.4 L11 6.2" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
		{:else}
			<path d="M8 4.4 L8 8.9" stroke-width="1.5" stroke-linecap="round" />
			<circle class="dot" cx="8" cy="11.4" r="0.9" />
		{/if}
	{/if}
</svg>

<style>
	.icon {
		flex: none;
		display: block;
	}

	.close,
	.chevron-down {
		stroke: var(--color-text-secondary);
	}

	.correct {
		stroke: var(--accent);
	}

	.missed {
		stroke: var(--color-status-missed);
	}

	.dot {
		stroke: none;
		fill: var(--color-status-missed);
	}

	/* The corner badge sits on a cell, so its disc is filled to stay readable over the cell's edge. */
	.disc {
		fill: var(--color-surface-card);
	}
</style>
