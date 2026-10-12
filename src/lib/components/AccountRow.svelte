<script lang="ts">
	import { account, signOut } from '$lib/sync/store.svelte';
	import Button from './Button.svelte';

	const status = $derived(
		account.offline
			? 'Offline. Answers are saved on this device and sync when you reconnect.'
			: account.failed
				? 'Sync failed. It will retry.'
				: account.syncing
					? 'Syncing…'
					: 'Synced'
	);
</script>

{#if account.status === 'signedIn'}
	<p class="who">{account.user?.email}</p>
	<p class="status">{status}</p>
	<Button variant="outline" onclick={() => void signOut()}>Sign out</Button>
{:else if account.status === 'signedOut'}
	<p class="status">Progress is on this device only.</p>
	<!-- A full navigation: the sign-in hop leaves the app for Google and returns. -->
	<Button href="/api/auth/google" reload>Sign in with Google</Button>
{/if}

<style>
	.who {
		font-weight: 800;
		text-align: center;
		overflow-wrap: anywhere;
	}

	.status {
		margin-top: 4px;
		color: var(--text-muted);
		font-size: 14px;
		text-align: center;
	}

	.who + .status {
		margin-bottom: 16px;
	}

	.status:first-child {
		margin-bottom: 16px;
	}
</style>
