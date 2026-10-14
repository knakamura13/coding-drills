<script lang="ts">
	import { page } from '$app/state';
	import { decks } from 'virtual:deck-index';
	import { status } from '$lib/nav/status.svelte';
	import { dismissIosHint, install, promptInstall } from '$lib/pwa/install.svelte';
	import Button from './Button.svelte';
	import Dialog from './Dialog.svelte';
	import Icon from './Icon.svelte';

	let { open, onclose }: { open: boolean; onclose: () => void } = $props();

	const snap = $derived(status.snapshot);
	const due = $derived(snap.review?.dueCount ?? 0);

	/** Marks the page the learner is on, for screen readers and the highlight. */
	const current = (href: string) => (page.url.pathname === href ? 'page' : undefined);
</script>

<Dialog {open} label="Menu" variant="drawer" {onclose}>
	<div class="head">
		<h2>Menu</h2>
		<button type="button" class="close" aria-label="Close menu" onclick={onclose}>
			<Icon name="close" size={22} />
		</button>
	</div>

	<nav aria-label="Main">
		<h3>Study</h3>
		<ul>
			<li><a href="/" aria-current={current('/')}>Home</a></li>
			{#if due > 0}
				<li><a href="/review">Review <span class="count due">{due} due</span></a></li>
			{/if}
			{#if snap.weak > 0}
				<li><a href="/weak">Weak spots <span class="count">{snap.weak}</span></a></li>
			{/if}
			<li><a href="/practice" aria-current={current('/practice')}>Mixed practice</a></li>
			<li>
				<a href="/decks" aria-current={current('/decks')}>All decks <span class="count">{decks.length}</span></a>
			</li>
		</ul>

		<h3>Track</h3>
		<ul>
			<li><a href="/progress" aria-current={current('/progress')}>Progress</a></li>
			<li>
				<a href="/flags" aria-current={current('/flags')}>
					Flagged questions
					{#if snap.flags > 0}
						<span class="count">{snap.flags}</span>
					{/if}
				</a>
			</li>
		</ul>

		<h3>App</h3>
		<ul>
			<li><a href="/settings" aria-current={current('/settings')}>Settings</a></li>
		</ul>
	</nav>

	{#if install.canPrompt || install.showIosHint}
		<section class="section" aria-labelledby="menu-install">
			<h3 id="menu-install">Install</h3>
			{#if install.canPrompt}
				<Button variant="outline" onclick={() => void promptInstall()}>Install the app</Button>
			{:else}
				<p class="note">To install: tap Share, then Add to Home Screen.</p>
				<button type="button" class="text-link" onclick={dismissIosHint}>Dismiss</button>
			{/if}
		</section>
	{/if}
</Dialog>

<style>
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	h2 {
		font-size: 21px;
		font-weight: 800;
		line-height: 1.2;
	}

	.close {
		display: grid;
		flex: none;
		place-items: center;
		width: 44px;
		height: 44px;
		padding: 0;
		border: 0;
		border-radius: 12px;
		background: none;
		color: var(--text);
		cursor: pointer;
	}

	h3 {
		margin: 22px 0 6px;
		color: var(--text-muted);
		font-size: 13px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	ul {
		display: grid;
		gap: 2px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	ul a {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		min-height: 48px;
		padding: 0 12px;
		border-radius: 12px;
		color: var(--text);
		font-weight: 700;
		text-decoration: none;
	}

	ul a:hover {
		background: var(--accent-soft);
	}

	ul a[aria-current='page'] {
		background: var(--accent-soft);
		color: var(--accent-glow);
	}

	.count {
		flex: none;
		color: var(--text-muted);
		font-size: 14px;
		font-variant-numeric: tabular-nums;
	}

	.count.due {
		color: var(--accent-glow);
	}

	.section {
		display: grid;
		gap: 10px;
	}

	.section h3 {
		margin-bottom: 0;
	}

	.note {
		color: var(--text-muted);
		font-size: 14px;
	}

	.text-link {
		display: inline-flex;
		justify-self: start;
		align-items: center;
		min-height: 44px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent-glow);
		font: inherit;
		font-weight: 700;
		text-decoration: underline;
		cursor: pointer;
	}
</style>
