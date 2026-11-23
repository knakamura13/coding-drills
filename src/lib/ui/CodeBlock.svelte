<!--
	A code snippet (lesson Round 2, Code C): Void inset, Twilight border, line numbers in Mist, code
	in Frost, keywords Starlight and SemiBold, no syntax colors. (Code C had Haze numbers and Mist code;
	Haze fails WCAG AA for text, so both moved up a step on 2026-11-23, keeping the hierarchy.) Long lines scroll sideways instead of
	wrapping. `current` (1-based) bands the running line in Dusk with a branch-color left edge
	(step-trace).
-->
<script lang="ts">
	import { codeLines } from './codeLines';

	let { code, current, label = 'Code' }: { code: string; current?: number; label?: string } = $props();

	const lines = $derived(codeLines(code));
</script>

<!-- Focusable so the snippet can be scrolled sideways from the keyboard. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<pre class="code" tabindex="0" aria-label={label}><code
		>{#each lines as runs, index (index)}<span class="line" class:current={index + 1 === current} aria-current={index + 1 === current ? 'step' : undefined}
				><span class="number" aria-hidden="true">{index + 1}</span><span class="text"
					>{#each runs as run, r (r)}{#if run.keyword}<b>{run.text}</b>{:else}{run.text}{/if}{/each}</span
				></span
			>{/each}</code
	></pre>

<style>
	.code {
		overflow-x: auto;
		padding: var(--space-3) 0;
		border: 1px solid var(--color-border-default);
		border-radius: var(--radius-control);
		background: var(--color-surface-inset);
		color: var(--neutral-frost);
		font-size: var(--text-code-size);
		line-height: var(--text-code-line);
		text-wrap: nowrap;
		white-space: pre;
		tab-size: 4;
	}

	code {
		display: grid;
		min-width: max-content;
	}

	.line {
		display: flex;
		gap: var(--space-3);
		padding-right: var(--space-4);
		/* Room for the current line's 2px edge, so the numbers never move. */
		border-left: 2px solid transparent;
		padding-left: var(--space-2);
	}

	.current {
		background: var(--color-surface-hover);
		border-left-color: var(--accent);
	}

	.number {
		flex: none;
		min-width: 2ch;
		text-align: right;
		color: var(--color-text-secondary);
		user-select: none;
	}

	b {
		font-weight: 600;
		color: var(--color-text-primary);
	}
</style>
