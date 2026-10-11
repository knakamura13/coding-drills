<script lang="ts">
	import type { SeeWhy } from '$lib/domain/lesson';
	import Button from './Button.svelte';
	import Dialog from './Dialog.svelte';
	import Icon from './Icon.svelte';
	import Markdown from './Markdown.svelte';

	let { open, why, onclose }: { open: boolean; why: SeeWhy | null; onclose: () => void } = $props();
</script>

<Dialog {open} label="Why the answers differ" {onclose}>
	<div class="handle" aria-hidden="true"></div>
	{#if why}
		<article class="card picked">
			<p class="label"><Icon name="x-circle" size={16} /> You picked</p>
			<h2><Markdown source={why.pickedText} inline /></h2>
			<div class="body"><Markdown source={why.pickedExplanation} /></div>
		</article>
		<article class="card correct">
			<p class="label"><Icon name="check-circle" size={16} /> Correct answer</p>
			<h2><Markdown source={why.correctText} inline /></h2>
			<div class="body"><Markdown source={why.correctExplanation} /></div>
		</article>
	{/if}
	<div class="actions">
		<Button variant="outline" onclick={onclose}>Got it</Button>
	</div>
</Dialog>

<style>
	.handle {
		width: 38.4px;
		height: 3.8px;
		margin: 0 auto 15px;
		border-radius: 4px;
		background: var(--line);
	}

	/* 15px of padding inside a 1px border (the reference's cards here are hairline, unlike the 2px
	   problem card). Rows: a 20px label, a 24px title, 21px body lines. The reference sets each row a
	   little lower in its box than centered CSS does: label 0.6px, title 0.35px, body 0.4px. */
	.card {
		padding: 15.6px 15px 14.63px;
		border: 1px solid;
		border-radius: 16px;
	}

	.card + .card {
		margin-top: 11px;
	}

	.picked {
		--glyph: var(--wrong-bg);
		border-color: var(--wrong-soft-line);
		background: var(--wrong-bg);
		color: var(--wrong-body);
	}

	.correct {
		--glyph: var(--right-bg);
		border-color: var(--right-soft-line);
		background: var(--right-bg);
		color: var(--right-body);
	}

	.label {
		display: flex;
		align-items: center;
		gap: 9.5px;
		height: 20px;
		font-size: 13px;
		font-weight: 700;
		line-height: 20px;
		letter-spacing: 0.46px;
	}

	.label :global(svg) {
		flex: none;
		margin-left: 1.8px;
	}

	.picked .label {
		color: var(--wrong-text);
	}

	.correct .label {
		color: var(--right-text);
	}

	h2 {
		margin-top: 5.75px;
		font-size: 16px;
		font-weight: 700;
		line-height: 24px;
		letter-spacing: 0.45px;
	}

	.body {
		margin-top: 6.02px;
		font-size: 14px;
		line-height: 21.14px;
		letter-spacing: 0.41px;
	}

	.actions {
		margin-top: 11px;
	}
</style>
