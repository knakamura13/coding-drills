<script lang="ts">
	import '@fontsource-variable/nunito';
	import '../app.css';
	import { onMount, type Snippet } from 'svelte';
	import { registerServiceWorker } from '$lib/pwa/register';

	let { children }: { children: Snippet } = $props();

	onMount(registerServiceWorker);
</script>

{@render children()}
