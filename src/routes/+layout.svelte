<script lang="ts">
	import '@fontsource-variable/nunito';
	import '../app.css';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

{@render children()}
