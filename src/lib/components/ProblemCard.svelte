<script lang="ts">
	import Markdown from './Markdown.svelte';

	let { prompt }: { prompt: string } = $props();
</script>

<section class="card" aria-label="Problem">
	<Markdown source={prompt} />
</section>

<style>
	/* 19px of padding inside a 2px border, 25px lines: two lines make a 92px card. The text sits
	   0.4px lower than centered CSS puts it, as in the reference. */
	.card {
		padding: 19.35px 19px 18.65px;
		border: 2px solid var(--line);
		border-radius: 16px;
		font-size: 16px;
		line-height: 25px;
		letter-spacing: 0.38px;
	}
</style>
