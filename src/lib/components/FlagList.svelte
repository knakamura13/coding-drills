<script lang="ts">
	import { issueUrl } from '$lib/flags/issueUrl';
	import type { Flag } from '$lib/storage/types';
	import Button from './Button.svelte';

	let { flags, onremove }: { flags: Flag[]; onremove?: (id: string) => void } = $props();
</script>

<ul class="flags">
	{#each flags as flag (flag.id)}
		<li class="flag">
			<p class="where">
				<code>{flag.deckId}</code> / <code>{flag.questionId}</code>
				{#if flag.stage === 'followUp'}
					<span class="stage">follow-up after <code>{flag.optionId}</code></span>
				{/if}
			</p>
			{#if flag.note}<p class="note">{flag.note}</p>{/if}
			<div class="row" class:two={onremove !== undefined}>
				<Button variant="outline" href={issueUrl(flag)} external>Open as GitHub issue</Button>
				{#if onremove}
					<Button variant="outline" onclick={() => onremove(flag.id)}>Remove</Button>
				{/if}
			</div>
		</li>
	{/each}
</ul>

<style>
	.flags {
		display: grid;
		gap: 14px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.flag {
		padding: 16px 18px 18px;
		border: 2px solid var(--line);
		border-radius: 16px;
	}

	.where {
		font-size: 15px;
		overflow-wrap: anywhere;
	}

	code {
		padding: 0.1em 0.4em;
		border-radius: 6px;
		background: var(--code-bg);
		color: var(--code-text);
		font-family: var(--mono);
		font-size: 0.9em;
	}

	.stage {
		display: block;
		margin-top: 4px;
		color: var(--text-muted);
	}

	.note {
		margin-top: 10px;
		overflow-wrap: anywhere;
	}

	.row {
		display: grid;
		gap: 12px;
		margin-top: 14px;
		padding-bottom: 4px;
	}

	.row.two {
		grid-template-columns: 1fr 1fr;
	}
</style>
