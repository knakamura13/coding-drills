<!--
	Deck Markdown on the new screens (lesson Round 2): paragraphs in body text, inline code in Geist
	Mono Frost that never wraps when short, numbered steps (worked examples, #137) and fenced code
	as a CodeBlock.
-->
<script lang="ts">
	import { markdownBlocks, renderInline } from '$lib/markdown/render';
	import CodeBlock from './CodeBlock.svelte';

	let { source }: { source: string } = $props();

	const blocks = $derived(markdownBlocks(source));
</script>

<div class="prose">
	{#each blocks as block, index (index)}
		{#if block.kind === 'code'}
			<CodeBlock code={block.code} />
		{:else if block.kind === 'steps'}
			<!-- role="list" keeps the list for VoiceOver, which drops it once list-style is none. -->
			<ol class="steps" role="list">
				{#each block.steps as step, s (s)}
					<!-- renderInline escapes HTML first, so the output is safe to inject. -->
					<li><span class="number">{s + 1}</span><span class="step">{@html renderInline(step)}</span></li>
				{/each}
			</ol>
		{:else}
			<!-- renderInline escapes HTML first, so the output is safe to inject. -->
			<p>{@html renderInline(block.text)}</p>
		{/if}
	{/each}
</div>

<style>
	.prose {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		font-size: var(--text-body-size);
		line-height: var(--text-body-line);
	}

	p,
	.step {
		text-wrap: pretty;
	}

	/* Inline code only: a CodeBlock's <code> keeps its own whitespace rules. */
	p :global(code),
	.step :global(code) {
		font-family: var(--font-mono);
		font-size: 0.9375em;
		color: var(--neutral-frost);
		white-space: nowrap;
	}

	/* Long expressions may wrap, so one cannot push the page wider than a phone. */
	p :global(code.long),
	.step :global(code.long) {
		white-space: normal;
		overflow-wrap: anywhere;
	}

	p :global(strong),
	.step :global(strong) {
		font-weight: 600;
	}

	/* Numbered steps (#137, Chain B): each number in a ring, joined to the next by a line, so the
	   steps read as a chain where each follows from the one before. The number is drawn by hand. */
	.steps {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: grid;
		grid-template-columns: 24px 1fr;
		column-gap: var(--space-3);
		position: relative;
	}

	/* Centered on the first line of the step. */
	.number {
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		margin-top: calc((var(--text-body-line) - 24px) / 2);
		border: 1px solid var(--color-border-strong);
		border-radius: 50%;
		background: var(--color-surface-card);
		color: var(--neutral-frost);
		font-size: var(--text-label-size);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}

	/* The line runs from this ring's bottom to the next ring's top. */
	li:not(:last-child)::before {
		content: '';
		position: absolute;
		left: 11.5px;
		top: calc((var(--text-body-line) + 24px) / 2);
		bottom: calc(-1 * var(--space-4) - (var(--text-body-line) - 24px) / 2);
		width: 1px;
		background: var(--color-border-strong);
	}
</style>
