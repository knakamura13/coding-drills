<!--
	The folded recap at the top of a follow-up (lesson Round 5, Follow-up A): the question and the
	pick, folded; tap to see the original prompt. A native <details>, so it opens from the keyboard
	and screen readers hear it as expandable.
-->
<script lang="ts">
	import { renderInline } from '$lib/markdown/render';
	import Icon from './Icon.svelte';
	import Prose from './Prose.svelte';

	let { title, prompt, picked }: { title: string; prompt: string; picked: string } = $props();
</script>

<details class="recap">
	<summary>
		<span class="text">
			<span class="question">{title}</span>
			<!-- renderInline escapes HTML first, so the output is safe to inject. -->
			<span class="pick">You picked {@html renderInline(picked)}</span>
		</span>
		<span class="chevron"><Icon name="chevron-down" /></span>
	</summary>
	<div class="body"><Prose source={prompt} /></div>
</details>

<style>
	.recap {
		border: 1px solid var(--color-border-default);
		border-radius: var(--radius-card);
		background: var(--color-surface-card);
	}

	summary {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		cursor: pointer;
		list-style: none;
		border-radius: var(--radius-card);
	}

	summary::-webkit-details-marker {
		display: none;
	}

	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: var(--text-label-size);
		line-height: var(--text-label-line);
	}

	.question {
		font-weight: var(--text-label-weight);
		color: var(--color-text-primary);
	}

	.pick {
		color: var(--color-text-secondary);
	}

	.pick :global(code) {
		font-family: var(--font-mono);
		white-space: nowrap;
	}

	/* Long expressions may wrap, so one cannot push the card wider than a phone. */
	.pick :global(code.long) {
		white-space: normal;
		overflow-wrap: anywhere;
	}

	.chevron {
		display: grid;
		transition: transform var(--dur-state) var(--ease);
	}

	.recap[open] .chevron {
		transform: rotate(180deg);
	}

	.body {
		padding: 0 var(--space-4) var(--space-4);
	}
</style>
