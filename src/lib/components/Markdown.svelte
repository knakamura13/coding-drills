<script lang="ts">
	import { renderInline, renderMarkdown } from '$lib/markdown/render';

	let { source, inline = false }: { source: string; inline?: boolean } = $props();

	// The renderer escapes HTML first, so the output is safe to inject.
	const html = $derived(inline ? renderInline(source) : renderMarkdown(source));
</script>

{#if inline}
	<span class="md-inline">{@html html}</span>
{:else}
	<div class="md">{@html html}</div>
{/if}
