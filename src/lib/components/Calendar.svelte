<script lang="ts">
	import type { DayCell } from '$lib/domain/stats';

	interface Props {
		/** Columns of seven days, Sunday first. Days after today are null. */
		weeks: (DayCell | null)[][];
		/** A sentence for screen readers, since the grid itself is decoration. */
		summary: string;
	}

	let { weeks, summary }: Props = $props();
</script>

<figure>
	<div class="grid" role="img" aria-label={summary} style:--weeks={weeks.length}>
		{#each weeks as week, w (w)}
			<div class="week">
				{#each week as cell, d (d)}
					<span class="cell level-{cell?.level ?? 'none'}" title={cell ? `${cell.day}: ${cell.count}` : undefined}></span>
				{/each}
			</div>
		{/each}
	</div>
	<figcaption aria-hidden="true">
		Less
		{#each [0, 1, 2, 3, 4] as level (level)}<span class="cell key level-{level}"></span>{/each}
		More
	</figcaption>
</figure>

<style>
	figure {
		max-width: 520px;
		margin: 0;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(var(--weeks), 1fr);
		gap: 4px;
	}

	.week {
		display: grid;
		grid-template-rows: repeat(7, auto);
		gap: 4px;
	}

	.cell {
		display: block;
		aspect-ratio: 1;
		border-radius: 4px;
		background: var(--line);
	}

	.level-none {
		background: transparent;
	}

	/* Each active level stays at 3:1 or more against the page, so the shading is visible (WCAG 1.4.11). */
	.level-0 {
		background: color-mix(in srgb, var(--line) 55%, var(--bg));
	}

	.level-1 {
		background: color-mix(in srgb, var(--accent) 78%, var(--bg));
	}

	.level-2 {
		background: color-mix(in srgb, var(--accent) 88%, var(--bg));
	}

	.level-3 {
		background: color-mix(in srgb, var(--accent-glow) 80%, var(--bg));
	}

	.level-4 {
		background: var(--accent-glow);
	}

	figcaption {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 4px;
		margin-top: 10px;
		color: var(--text-muted);
		font-size: 12px;
	}

	.key {
		width: 14px;
		aspect-ratio: 1;
	}
</style>
