<script lang="ts">
	import '@fontsource-variable/nunito';
	import '../app.css';
	// The Latin subset is needed for every page. Preloading it keeps the fallback font on screen
	// for less time, so the swap to Nunito moves less text (Cumulative Layout Shift).
	import nunitoLatin from '@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2?url';
	import { afterNavigate, onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount, type Snippet } from 'svelte';
	import SiteMenu from '$lib/components/SiteMenu.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import { refreshStatus } from '$lib/nav/status.svelte';
	import { initPreferences } from '$lib/preferences/store.svelte';
	import { watchInstall } from '$lib/pwa/install.svelte';
	import { registerServiceWorker } from '$lib/pwa/register';
	import { loadShortcuts } from '$lib/settings/shortcuts.svelte';
	import { account, initSync } from '$lib/sync/store.svelte';

	let { children }: { children: Snippet } = $props();

	// A lesson has no top bar or menu. Leaving one uses the lesson's own control, which asks first.
	const LESSON_ROUTES = new Set(['/play/[deckId]', '/review', '/weak', '/practice']);
	const inLesson = $derived(LESSON_ROUTES.has(page.route.id ?? ''));

	let menuOpen = $state(false);
	// The control that opened the menu. Closing the menu from its own controls returns focus there.
	let opener: HTMLElement | null = null;

	function openMenu(button: HTMLElement) {
		opener = button;
		menuOpen = true;
	}

	// Runs when the menu closes itself: its close button, the backdrop, or Escape. A navigation
	// also closes it, and then focus belongs to the page that loads, so nothing is returned.
	function closeMenu() {
		if (!menuOpen) return;
		menuOpen = false;
		opener?.focus();
	}

	// Counts are read on mount, after each page change, and when a sync brings new data.
	$effect(() => {
		void page.url.pathname;
		void account.version;
		refreshStatus();
	});

	afterNavigate(() => {
		menuOpen = false;
	});

	onMount(() => {
		initPreferences();
		registerServiceWorker();
		watchInstall();
		loadShortcuts();
		void initSync();
	});

	// Page changes cross-fade where the browser supports it. Reduced motion skips the fade.
	onNavigate((navigation) => {
		if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<svelte:head>
	<link rel="preload" href={nunitoLatin} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<a class="skip-link" href="#content">Skip to content</a>

{#if !inLesson}
	<TopBar {menuOpen} onmenu={openMenu} />
	<SiteMenu open={menuOpen} onclose={closeMenu} />
{/if}

<div id="content" tabindex="-1" class:bar={!inLesson}>
	{@render children()}
</div>
