<script lang="ts">
	import { resolve } from '$app/paths';
	import BrandMark from '$lib/components/BrandMark.svelte';
	import { APP_NAME } from '$lib/config';
	import { status } from '$lib/nav/status.svelte';
	import Icon from './Icon.svelte';

	// The button is passed back so focus can return to it. Safari does not focus a button on click,
	// so focus cannot be read from the page at the moment the menu opens.
	let { menuOpen, wide = false, onmenu }: { menuOpen: boolean; wide?: boolean; onmenu: (opener: HTMLElement) => void } =
		$props();

	// A dot on the menu button shows that questions are due, before the menu is opened.
	const due = $derived(status.snapshot.review?.dueCount ?? 0);
</script>

<header class="bar" class:wide>
	<div class="inner">
		<a class="brand" href={resolve('/')}><BrandMark height={24} />{APP_NAME}</a>
		<span class="offline" role="status">Offline</span>
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
		padding: max(8px, env(safe-area-inset-top)) max(var(--gutter), env(safe-area-inset-right)) 8px
			max(var(--gutter), env(safe-area-inset-left));
	}

	/* The mastery tree is wider than the other pages. Keep this in step with .page.tree. */
	.wide .inner {
		max-width: 1120px;
	}

	/* Wraps rather than truncates, so the name survives larger text spacing (WCAG 1.4.12). The link
	   is as wide as the mark and name, and the auto margin keeps the rest of the bar on the right.
	   Its 8px padding is taken back by the margin, so the mark stays on the page's edge. */
	.brand {
		gap: 6px;
		flex: 0 1 auto;
		min-width: 0;
		min-height: 44px;
		display: flex;
		align-items: center;
		margin-left: -8px;
		margin-right: auto;
		padding: 0 8px;
		border-radius: 12px;
		color: var(--text);
		font-size: 17px;
		font-weight: 800;
		letter-spacing: 0.2px;
		text-decoration: none;
	}

	/* The site menu's link hover. Focus shows it too, under the focus ring. */
	.brand:focus-visible {
		background: var(--accent-soft);
	}

	@media (hover: hover) {
		.brand:hover {
			background: var(--accent-soft);
		}
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
