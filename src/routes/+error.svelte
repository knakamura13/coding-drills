<script lang="ts">
	import { page } from '$app/state';
	import Button from '$lib/components/Button.svelte';
	import { APP_NAME } from '$lib/config';
</script>

<svelte:head>
	<title>{page.status} · {APP_NAME}</title>
</svelte:head>

<main class="page">
	<h1>{page.status === 404 ? 'Not found' : 'Something went wrong'}</h1>
	<p>{page.error?.message ?? 'Unexpected error'}</p>
	<div class="home"><Button href="/">Home</Button></div>
</main>

<style>
	h1 {
		font-size: 28px;
		font-weight: 800;
	}

	p {
		margin-top: 10px;
		color: var(--text-muted);
	}

	.home {
		margin-top: 28px;
	}
</style>
