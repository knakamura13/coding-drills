<!--
	Deck Markdown on the new screens (lesson Round 2): paragraphs in body text, inline code in Geist
	Mono Frost that never wraps when short, and fenced code as a CodeBlock.
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

	p {
		text-wrap: pretty;
	}

	.prose :global(code) {
		font-family: var(--font-mono);
		font-size: 0.9375em;
		color: var(--neutral-frost);
		white-space: nowrap;
	}

	/* Long expressions may wrap, so one cannot push the page wider than a phone. */
	.prose :global(code.long) {
		white-space: normal;
		overflow-wrap: anywhere;
	}

	.prose :global(strong) {
		font-weight: 600;
	}
</style>
