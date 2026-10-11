<script lang="ts">
	import { focusOnMount } from '$lib/actions';
	import type { Summary } from '$lib/domain/lesson';
	import { plainText } from '$lib/markdown/render';
	import type { Flag } from '$lib/storage/types';
	import Button from './Button.svelte';
	import FlagList from './FlagList.svelte';
	import Icon from './Icon.svelte';
	import Markdown from './Markdown.svelte';

	interface Props {
		summary: Summary;
		/** Flags created or updated during this run. */
		flags: Flag[];
		onretry: () => void;
	}

	let { summary, flags, onretry }: Props = $props();
</script>

<main class="page summary">
	<h1 tabindex="-1" use:focusOnMount>Session complete</h1>

	<p class="score">
		{summary.correctFirstTry} of {summary.total} right on the first try
	</p>
	{#if summary.followUpsAttempted > 0}
		<p class="followups">
			{summary.followUpsCorrect} of {summary.followUpsAttempted}
			{summary.followUpsAttempted === 1 ? 'follow-up' : 'follow-ups'} right
		</p>
	{/if}

	{#if summary.missed.length > 0}
		<section aria-labelledby="missed-heading">
			<h2 id="missed-heading">Missed</h2>
			<ul class="missed">
				{#each summary.missed as miss (miss.questionId)}
					<li class="miss">
						<p class="prompt">{plainText(miss.prompt, 110)}</p>
						<p class="line wrong">
							<Icon name="x-circle" size={20} />
							<span>You picked <strong><Markdown source={miss.pickedText} inline /></strong></span>
						</p>
						<p class="line right">
							<Icon name="check-circle" size={20} />
							<span>Answer <strong><Markdown source={miss.correctText} inline /></strong></span>
						</p>
						<p class="followup" class:got-it={miss.followUpCorrect}>
							Follow-up: {miss.followUpCorrect ? 'right' : 'missed'}
						</p>
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		<p class="clean">No misses, so there was nothing to follow up on.</p>
	{/if}

	{#if flags.length > 0}
		<section aria-labelledby="flagged-heading">
			<h2 id="flagged-heading">Flagged</h2>
			<FlagList {flags} />
		</section>
	{/if}

	<div class="actions">
		<Button onclick={onretry}>Take it again</Button>
		<Button variant="outline" href="/">Back to decks</Button>
	</div>
</main>

<style>
	.summary {
		display: block;
	}

	h1 {
		font-size: 28px;
		font-weight: 800;
		line-height: 1.2;
		outline: none;
	}

	.score {
		margin-top: 14px;
		font-size: 20px;
		font-weight: 800;
	}

	.followups {
		margin-top: 4px;
		color: var(--text-muted);
		font-size: 17px;
	}

	h2 {
		margin-top: 32px;
		margin-bottom: 12px;
		color: var(--text-muted);
		font-size: 13px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.missed {
		display: grid;
		gap: 14px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.miss {
		padding: 16px 18px;
		border: 2px solid var(--line);
		border-radius: 16px;
	}

	.prompt {
		margin-bottom: 10px;
		font-weight: 700;
		overflow-wrap: anywhere;
	}

	.line {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		margin-top: 6px;
		font-size: 16px;
	}

	.line.wrong {
		color: var(--wrong-text);
	}

	.line.right {
		color: var(--right-text);
	}

	.line :global(svg) {
		flex: none;
		margin-top: 2px;
	}

	.line strong {
		color: var(--text);
		font-weight: 700;
	}

	.followup {
		margin-top: 10px;
		color: var(--text-muted);
		font-size: 15px;
	}

	.followup.got-it {
		color: var(--right-text);
	}

	.clean {
		margin-top: 28px;
		color: var(--text-muted);
	}

	.actions {
		display: grid;
		gap: 12px;
		margin-top: 36px;
		padding-bottom: 8px;
	}
</style>
