<script lang="ts">
	import { APP_NAME } from '$lib/config';
	import { status } from '$lib/nav/status.svelte';
	import { account } from '$lib/sync/store.svelte';
	import Icon from './Icon.svelte';

	// The button is passed back so focus can return to it. Safari does not focus a button on click,
	// so focus cannot be read from the page at the moment the menu opens.
	let { menuOpen, onmenu }: { menuOpen: boolean; onmenu: (opener: HTMLElement) => void } = $props();

	// A dot on the menu button shows that questions are due, before the menu is opened.
	const due = $derived(status.snapshot.review?.dueCount ?? 0);
</script>

<header class="bar">
	<div class="inner">
		<a class="brand" href="/">{APP_NAME}</a>
		{#if account.offline}
			<span class="offline" role="status">Offline</span>
		{/if}
		<button
			type="button"
			class="menu"
			aria-haspopup="dialog"
			aria-expanded={menuOpen}
			aria-label={due > 0 ? `Menu, ${due} due` : 'Menu'}
			onclick={(event) => onmenu(event.currentTarget)}
		>
			<Icon name="menu" size={24} />
			{#if due > 0}
				<span class="dot" aria-hidden="true"></span>
			{/if}
		</button>
	</div>
</header>

<style>
	/* Stays at the top while a long page scrolls, so the menu is one tap away. */
	.bar {
		position: sticky;
		top: 0;
		z-index: 10;
		background: var(--bg);
	}

	.inner {
		display: flex;
		align-items: center;
		gap: 10px;
		max-width: var(--wide);
		margin: 0 auto;
		padding: max(8px, env(safe-area-inset-top)) var(--gutter) 8px;
	}

	/* Wraps rather than truncates, so the name survives larger text spacing (WCAG 1.4.12). */
	.brand {
		flex: 1;
		min-width: 0;
		min-height: 44px;
		display: flex;
		align-items: center;
		color: var(--text);
		font-size: 17px;
		font-weight: 800;
		letter-spacing: 0.2px;
		text-decoration: none;
	}

	.offline {
		flex: none;
		padding: 2px 10px;
		border: 2px solid var(--line);
		border-radius: 999px;
		color: var(--text-muted);
		font-size: 12px;
		font-weight: 700;
	}

	.menu {
		position: relative;
		display: grid;
		flex: none;
		place-items: center;
		width: 44px;
		height: 44px;
		padding: 0;
		border: 2px solid var(--line);
		border-radius: 12px;
		background: var(--bg);
		color: var(--text);
		cursor: pointer;
	}

	.menu[aria-expanded='true'] {
		border-color: var(--accent);
	}

	.dot {
		position: absolute;
		top: 7px;
		right: 7px;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--accent-glow);
	}
</style>
