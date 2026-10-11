<script lang="ts">
	import Lesson from '$lib/components/Lesson.svelte';
	import { APP_NAME } from '$lib/config';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.deck.title} · {APP_NAME}</title>
</svelte:head>

{#key data.deck.id}
	<Lesson deck={data.deck} />
{/key}
