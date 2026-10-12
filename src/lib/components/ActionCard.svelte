<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';

	interface Props {
		id: string;
		kicker: string;
		title: string;
		description: string;
		/** Where the button goes. Omit for a card with nothing to do yet. */
		href?: string;
		action?: string;
		children?: Snippet;
	}

	let { id, kicker, title, description, href, action, children }: Props = $props();
</script>

<article class="card" aria-labelledby="card-{id}">
	<p class="kicker">{kicker}</p>
	<h2 id="card-{id}">{title}</h2>
	<p class="description">{description}</p>
	{@render children?.()}
	{#if href && action}
		<div class="start"><Button {href}>{action}</Button></div>
	{/if}
</article>

<style>
	.card {
		padding: 19px;
		border: 2px solid var(--line);
		border-radius: 16px;
	}

	.kicker {
		color: var(--text-muted);
		font-size: 10px;
		font-weight: 700;
		line-height: 15px;
		letter-spacing: 1.5px;
		text-transform: uppercase;
	}

	h2 {
		margin-top: 16.3px;
		font-size: 17px;
		font-weight: 700;
		line-height: 25px;
	}

	.description {
		margin-top: 5px;
		color: var(--text-muted);
		font-size: 13px;
		line-height: 19.2px;
	}

	.start {
		margin-top: 16.2px;
	}
</style>
