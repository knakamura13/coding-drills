<script lang="ts">
	import { onMount } from 'svelte';
	import { dismissIosHint, install, promptInstall, watchInstall } from '$lib/pwa/install.svelte';

	onMount(watchInstall);
</script>

{#if install.canPrompt}
	<p class="hint"><button type="button" onclick={() => void promptInstall()}>Install the app</button></p>
{:else if install.showIosHint}
	<p class="hint">
		<span>To install: tap Share, then Add to Home Screen.</span>
		<button type="button" onclick={dismissIosHint}>Dismiss</button>
	</p>
{/if}

<style>
	.hint {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: center;
		gap: 4px 12px;
		color: var(--text-muted);
		font-size: 13px;
		text-align: center;
	}

	button {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent-glow);
		font: inherit;
		font-weight: 700;
		text-decoration: underline;
		cursor: pointer;
	}
</style>
