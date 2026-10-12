<script lang="ts">
	import '@fontsource-variable/nunito';
	import '../app.css';
	import { onMount, type Snippet } from 'svelte';
	import { initPreferences } from '$lib/preferences/store.svelte';
	import { registerServiceWorker } from '$lib/pwa/register';

	let { children }: { children: Snippet } = $props();

	onMount(() => {
		initPreferences();
		registerServiceWorker();
	});
</script>

{@render children()}
