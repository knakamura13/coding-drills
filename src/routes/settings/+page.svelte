<script lang="ts">
	import { onMount } from 'svelte';
	import AccountRow from '$lib/components/AccountRow.svelte';
	import Button from '$lib/components/Button.svelte';
	import Dialog from '$lib/components/Dialog.svelte';
	import { APP_NAME } from '$lib/config';
	import { THEME_CHOICES, type ThemeChoice } from '$lib/preferences/preferences';
	import { initPreferences, preferences, setPreference } from '$lib/preferences/store.svelte';
	import { setShortcuts, shortcuts } from '$lib/settings/shortcuts.svelte';
	import { account, initSync } from '$lib/sync/store.svelte';

	type ToggleKey = 'sound' | 'haptics' | 'immediateFeedback';

	const TOGGLES: readonly { key: ToggleKey; label: string; hint: string }[] = [
		{ key: 'sound', label: 'Sound effects', hint: 'Short sounds on right and wrong answers.' },
		{ key: 'haptics', label: 'Haptics', hint: 'Vibration feedback on answer and on correct/wrong.' },
		{
			key: 'immediateFeedback',
			label: 'Immediate feedback on quizzes',
			hint: 'Show right or wrong as soon as an option is picked.'
		}
	];

	let ready = $state(false);
	let feedbackOpen = $state(false);

	onMount(() => {
		initPreferences();
		ready = true;
		void initSync();
	});

	function onToggle(key: ToggleKey, event: Event) {
		const input = event.currentTarget;
		if (!(input instanceof HTMLInputElement)) return;
		setPreference(key, input.checked);
		if (key === 'immediateFeedback' && input.checked) feedbackOpen = true;
	}

	function chooseTheme(choice: ThemeChoice) {
		setPreference('theme', choice);
	}
</script>

<svelte:head>
	<title>Settings · {APP_NAME}</title>
</svelte:head>

<main class="page">
	<header class="bar">
		<a class="back" href="/">
			<span aria-hidden="true">←</span>
			<span class="sr-only">Back</span>
		</a>
		<h1>Settings</h1>
	</header>

	{#if ready}
		<section aria-label="Preferences">
			{#each TOGGLES as toggle (toggle.key)}
				<label class="row">
					<span class="copy">
						<span id="{toggle.key}-label" class="name">{toggle.label}</span>
						<span id="{toggle.key}-hint" class="hint">{toggle.hint}</span>
					</span>
					<span class="switch">
						<input
							type="checkbox"
							role="switch"
							aria-labelledby="{toggle.key}-label"
							aria-describedby="{toggle.key}-hint"
							checked={preferences[toggle.key]}
							onchange={(event) => onToggle(toggle.key, event)}
						/>
						<span class="track" aria-hidden="true"></span>
					</span>
				</label>
			{/each}
			<label class="row">
				<span class="copy">
					<span id="shortcuts-label" class="name">Single-key shortcuts</span>
					<span id="shortcuts-hint" class="hint">1 to 9 choose an answer, and / filters the decks.</span>
				</span>
				<span class="switch">
					<input
						type="checkbox"
						role="switch"
						aria-labelledby="shortcuts-label"
						aria-describedby="shortcuts-hint"
						checked={shortcuts.enabled}
						onchange={(event) => setShortcuts(event.currentTarget.checked)}
					/>
					<span class="track" aria-hidden="true"></span>
				</span>
			</label>
		</section>

		<fieldset class="appearance">
			<legend>Appearance</legend>
			<div class="choices">
				{#each THEME_CHOICES as choice (choice.id)}
					<label class="choice">
						<input
							type="radio"
							name="theme"
							value={choice.id}
							checked={preferences.theme === choice.id}
							onchange={() => chooseTheme(choice.id)}
						/>
						{choice.label}
					</label>
				{/each}
			</div>
		</fieldset>
	{/if}

	{#if account.status === 'signedIn' || account.status === 'signedOut'}
		<section class="account" aria-labelledby="account-heading">
			<h2 id="account-heading">Account</h2>
			<AccountRow />
		</section>
	{/if}
</main>

<Dialog open={feedbackOpen} label="Immediate feedback is on" onclose={() => (feedbackOpen = false)}>
	<h2 class="dialog-title">Immediate feedback is on</h2>
	<p class="explain">
		Picking an option shows right or wrong at once, with no separate Check step. A wrong answer still opens its follow-up.
	</p>
	<ul class="sample">
		<li class="tile">Unanswered</li>
		<li class="tile correct">Correct</li>
		<li class="tile wrong">Wrong</li>
	</ul>
	<Button onclick={() => (feedbackOpen = false)}>Got it</Button>
</Dialog>

<style>
	.bar {
		display: grid;
		grid-template-columns: 44px 1fr 44px;
		align-items: center;
		margin-bottom: 8px;
	}

	.back {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		margin-left: -10px;
		color: var(--text);
		font-size: 22px;
		line-height: 1;
		text-decoration: none;
	}

	h1 {
		font-size: 20px;
		font-weight: 800;
		line-height: 1.2;
		text-align: center;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 16px;
		min-height: 44px;
		padding: 12px 0;
		border-bottom: 1px solid var(--line);
	}

	.copy {
		display: grid;
		flex: 1;
		gap: 2px;
	}

	.name {
		font-weight: 800;
	}

	.hint {
		color: var(--text-muted);
		font-size: 13px;
		line-height: 1.35;
	}

	.switch {
		position: relative;
		flex: none;
		width: 48px;
		height: 28px;
	}

	.switch input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}

	.track {
		display: block;
		height: 28px;
		border-radius: 999px;
		background: var(--line);
		pointer-events: none;
	}

	.track::after {
		content: '';
		position: absolute;
		top: 3px;
		left: 3px;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--text);
	}

	.switch:has(input:checked) .track {
		background: var(--accent);
	}

	.switch:has(input:checked) .track::after {
		transform: translateX(20px);
	}

	.switch:has(input:focus-visible) .track {
		outline: 3px solid var(--accent-glow);
		outline-offset: 2px;
	}

	.appearance {
		margin: 28px 0 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}

	legend,
	h2 {
		margin-bottom: 12px;
		padding: 0;
		font-size: 18px;
		font-weight: 800;
	}

	.choices {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}

	.choice {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 44px;
		border: 2px solid var(--line);
		border-radius: 12px;
		font-weight: 800;
		cursor: pointer;
	}

	.choice:has(input:checked) {
		border-color: var(--accent);
	}

	.choice input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}

	.choice:has(input:focus-visible) {
		outline: 3px solid var(--accent-glow);
		outline-offset: 2px;
	}

	.account {
		margin-top: 28px;
	}

	.dialog-title {
		font-size: 18px;
		font-weight: 800;
		line-height: 1.3;
	}

	.explain {
		margin-top: 8px;
		color: var(--text-muted);
	}

	.sample {
		display: grid;
		gap: 8px;
		margin: 16px 0;
		padding: 0;
		list-style: none;
	}

	.tile {
		padding: 10px 12px;
		border: 2px solid var(--line);
		border-radius: 12px;
		background: var(--bg);
		font-weight: 800;
		text-align: center;
	}

	.tile.correct {
		border-color: var(--right-line);
		background: var(--right-bg);
		color: var(--right-text);
	}

	.tile.wrong {
		border-color: var(--wrong-line);
		background: var(--wrong-bg);
		color: var(--wrong-text);
	}
</style>
