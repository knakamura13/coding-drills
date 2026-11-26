<script lang="ts">
	import regular from '$lib/assets/facet-50.png';
	import small from '$lib/assets/facet-80.png';

	let { height }: { height: number } = $props();
</script>

<img src={height < 40 ? small : regular} alt="" {height} style="aspect-ratio: 277 / 375; width: auto; flex: none" />
