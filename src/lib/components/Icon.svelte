<script lang="ts">
	type Name = 'close' | 'flag' | 'check-circle' | 'x-circle' | 'book' | 'menu';

	let { name, size = 24 }: { name: Name; size?: number } = $props();
</script>

<!-- Decorative: every use sits next to a text label or inside a labelled button. -->
<!-- The circle icons fill their box, so `size` is the circle diameter. Their glyph is cut out in
     the surface color (--glyph), the way the reference draws it. -->
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
	{#if name === 'close'}
		<path d="M4 4l16 16M20 4L4 20" stroke="currentColor" stroke-width="2.5" />
	{:else if name === 'menu'}
		<path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
	{:else if name === 'flag'}
		<path
			d="M5.7 20.3V4.6h7v2.1h5.7v7.9h-5.7v-2.2h-7"
			stroke="currentColor"
			stroke-width="1.8"
			stroke-linejoin="miter"
		/>
	{:else if name === 'check-circle'}
		<circle cx="12" cy="12" r="12" fill="currentColor" />
		<path
			d="M5.2 11.9l4.7 4.7 8.95-9"
			stroke="var(--glyph, var(--on-color))"
			stroke-width="2.45"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	{:else if name === 'x-circle'}
		<circle cx="12" cy="12" r="12" fill="currentColor" />
		<path
			d="M7.8 7.8l8.4 8.4M16.2 7.8l-8.4 8.4"
			stroke="var(--glyph, var(--on-color))"
			stroke-width="2.6"
			stroke-linecap="round"
		/>
	{:else if name === 'book'}
		<!-- Open book: the left page is solid, the right page is an outline. -->
		<g transform="translate(12 12) scale(0.97 1) translate(-12 -12)">
			<path d="M5.2 4.85L12 5.7V19.15L5.2 18.35A1 1 0 0 1 4.2 17.35V5.85A1 1 0 0 1 5.2 4.85Z" fill="currentColor" />
			<path
				fill-rule="evenodd"
				clip-rule="evenodd"
				fill="currentColor"
				d="M18.8 4.85L12 5.7V19.15L18.8 18.35A1 1 0 0 0 19.8 17.35V5.85A1 1 0 0 0 18.8 4.85ZM12.45 7.5L18.1 6.75V15.65L12.45 16.4Z"
			/>
		</g>
	{/if}
</svg>
