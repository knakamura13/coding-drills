<script lang="ts">
	import { account, signOut } from '$lib/sync/store.svelte';

</script>

{#if account.status === 'signedIn'}
	<p class="account">
		<span>
			{#if account.offline}
				Offline. Answers are saved on this device and sync when you reconnect.
			{:else if account.failed}
				Sync failed. It will retry.
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

	/* A 44px tap target, with the text kept where it was. */
	button,
	a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		font: inherit;
		font-weight: 700;
		color: var(--accent-glow);
		background: none;
		border: 0;
		padding: 0;
		cursor: pointer;
		text-decoration: underline;
	}

</style>
