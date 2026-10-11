<script lang="ts">
	import { account, signOut } from '$lib/sync/store.svelte';

	/** Set from the sign-in redirect, for example "denied". */
	let { notice = '' }: { notice?: string } = $props();

	const message = $derived(
		notice === 'denied'
			? 'That Google account is not allowed to sync.'
			: notice === 'failed'
				? 'Sign-in did not complete. Try again.'
				: notice === 'misconfigured'
					? 'Google sign-in is not set up correctly on the server: GOOGLE_CLIENT_ID should be the Client ID, which ends in .apps.googleusercontent.com.'
					: ''
	);
</script>

{#if account.status === 'signedIn'}
	<p class="account">
		<span>
			{#if account.failed}
				Sync failed. Retrying when you are back online.
			{:else if account.syncing}
				Syncing…
			{:else}
				Synced as {account.user?.email}
			{/if}
		</span>
		<button type="button" onclick={() => void signOut()}>Sign out</button>
	</p>
{:else if account.status === 'signedOut'}
	<p class="account">
		<span>Progress is on this device only.</span>
		<!-- A full navigation: the sign-in hop leaves the app for Google and returns. -->
		<a href="/api/auth/google" data-sveltekit-reload>Sign in with Google to sync</a>
	</p>
{/if}
{#if message}
	<p class="notice" role="status">{message}</p>
{/if}

<style>
	.account {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: center;
		gap: 4px 12px;
		color: var(--text-muted);
		font-size: 13px;
		text-align: center;
	}

	button,
	a {
		font: inherit;
		font-weight: 700;
		color: var(--accent-glow);
		background: none;
		border: 0;
		padding: 0;
		cursor: pointer;
		text-decoration: underline;
	}

	.notice {
		margin-top: 8px;
		color: var(--wrong-text);
		font-size: 13px;
		text-align: center;
	}
</style>
