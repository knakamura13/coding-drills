<script lang="ts">
	import type { OptionView } from '$lib/domain/lesson';
	import Markdown from './Markdown.svelte';

	interface Props {
		options: OptionView[];
		selectedId: string | null;
		/** True once the answer is checked: no more changes. */
		locked: boolean;
		legend: string;
		/** Radio group name, unique per step so the browser never carries a pick over. */
		name: string;
		onselect: (id: string) => void;
	}

	let { options, selectedId, locked, legend, name, onselect }: Props = $props();

	// Short labels such as pattern names read best centered, sentences read best left-aligned.
	const centered = $derived(options.every((option) => option.text.length <= 28));
</script>

<fieldset class="options" disabled={locked}>
	<legend class="sr-only">{legend}</legend>
	{#each options as option (option.id)}
		<label class="option {option.state}" class:centered class:locked>
			<input
				type="radio"
				{name}
				value={option.id}
				checked={selectedId === option.id}
				onchange={() => onselect(option.id)}
			/>
			<span class="label"><Markdown source={option.text} inline /></span>
		</label>
	{/each}
</fieldset>

<style>
	.options {
		display: grid;
		gap: 7.77px;
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}

	/* A tile is a 2px outline with a 4px bottom edge: 53.5px for one 25px line, 78.5px for two. */
	.option {
		position: relative;
		display: block;
		padding: 11.25px 13px;
		border: 2px solid var(--line);
		border-bottom-width: 4px;
		border-radius: 12px;
		background: var(--bg);
		font-size: 17px;
		font-weight: 600;
		line-height: 25px;
		letter-spacing: 0.37px;
		cursor: pointer;
		transition:
			transform 80ms ease,
			border-color 120ms ease,
			background-color 120ms ease;
	}

	.option.centered {
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
	}

	/* The native radio fills the tile, so a click anywhere selects it and the
	   browser supplies arrow-key navigation and screen-reader semantics. */
	input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		opacity: 0;
		cursor: inherit;
	}

	.option:hover:not(.locked):not(.selected) {
		border-color: #5a5a6e;
	}

	/* Pressing sinks the tile onto its edge. The margin keeps the layout from moving. */
	.option:active:not(.locked) {
		transform: translateY(2px);
		margin-bottom: 2px;
		border-bottom-width: 2px;
	}

	.option:has(input:focus-visible) {
		outline: 3px solid var(--accent-glow);
		outline-offset: 3px;
	}

	.option.selected {
		border-color: var(--accent);
		border-bottom-color: var(--accent-edge);
		background: var(--accent-soft);
	}

	/* Once checked, the answer tiles go flat: a 2px outline all round. */
	.option.correct {
		margin-bottom: 2px;
		border-color: var(--right-line);
		border-bottom-width: 2px;
		background: var(--right-bg);
	}

	.option.wrong {
		margin-bottom: 2px;
		border-color: var(--wrong-line);
		border-bottom-width: 2px;
		background: var(--wrong-bg);
	}

	.option.locked {
		cursor: default;
	}
</style>
