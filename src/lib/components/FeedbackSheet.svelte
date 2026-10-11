<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		tone: 'correct' | 'wrong';
		title: string;
		/** Rendered height, so the page can leave room for the sheet. */
		height?: number;
		onflag: () => void;
		/** Present only after a wrong main answer. */
		onseewhy?: () => void;
		oncontinue: () => void;
		children: Snippet;
	}

	let { tone, title, height = $bindable(0), onflag, onseewhy, oncontinue, children }: Props = $props();

	let continueButton: HTMLElement | undefined = $state();

	// Keyboard users land on Continue as soon as the verdict appears.
	$effect(() => {
		continueButton?.focus({ preventScroll: true });
	});
</script>

<section class="sheet {tone}" aria-label="Answer feedback" bind:clientHeight={height}>
	<div class="inner">
		<div class="head">
			<span class="icon"><Icon name={tone === 'correct' ? 'check-circle' : 'x-circle'} size={19} /></span>
			<h2>{title}</h2>
			<button type="button" class="flag" aria-label="Flag this question" onclick={onflag}>
				<Icon name="flag" size={24} />
			</button>
		</div>
		<div class="message">{@render children()}</div>
		<div class="actions">
			{#if onseewhy}
				<Button variant="outline" onclick={onseewhy}>See why again</Button>
			{/if}
			<Button variant={tone === 'correct' ? 'success' : 'danger'} bind:el={continueButton} onclick={oncontinue}>
				Continue
			</Button>
		</div>
	</div>
</section>

<style>
	/* A flat, full-width panel. The home-indicator inset is added to a 13.8px base. */
	.sheet {
		position: fixed;
		inset: auto 0 0;
		z-index: 20;
		padding: 10.4px var(--gutter) max(24px, calc(env(safe-area-inset-bottom) + 13.8px));
		animation: rise 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.correct {
		--glyph: var(--right-bg);
		background: var(--right-bg);
		color: var(--right-body);
	}

	.wrong {
		--glyph: var(--wrong-bg);
		background: var(--wrong-bg);
		color: var(--wrong-body);
	}

	.inner {
		max-width: calc(var(--column) - 2 * var(--gutter));
		margin: 0 auto;
	}

	/* The row is 40px tall so the flag button is a comfortable tap target. */
	.head {
		display: flex;
		align-items: center;
		gap: 10.1px;
		height: 40px;
	}

	.icon {
		display: grid;
		flex: none;
		margin-left: 1.75px;
	}

	.correct .icon,
	.correct h2 {
		color: var(--right-text);
	}

	.wrong .icon,
	.wrong h2 {
		color: var(--wrong-text);
	}

	h2 {
		flex: 1;
		font-size: 17px;
		font-weight: 700;
		line-height: 20px;
		letter-spacing: 0.35px;
	}

	/* The flag glyph is 14.5px wide inside its 24px box; the button reaches past the gutter
	   so the glyph lines up the way the reference has it. */
	.flag {
		position: relative;
		display: grid;
		flex: none;
		place-items: center;
		width: 40px;
		height: 40px;
		margin-right: -5.05px;
		padding: 0;
		border: 0;
		border-radius: 12px;
		background: none;
		color: inherit;
		cursor: pointer;
	}

	.correct .flag {
		top: 0.87px;
		color: var(--right-text);
	}

	.wrong .flag {
		top: 0.44px;
		color: var(--wrong-text);
	}

	/* The reference sets the green sheet's title a little lower against its icon than the red one. */
	.correct h2 {
		position: relative;
		top: 1.22px;
	}

	.message {
		margin-top: 3.7px;
		font-size: 15px;
		line-height: 21px;
		letter-spacing: 0.4px;
	}

	.actions {
		display: grid;
		gap: 7.6px;
		margin-top: 15.4px;
	}

	@keyframes rise {
		from {
			transform: translateY(100%);
		}
		to {
			transform: none;
		}
	}
</style>
