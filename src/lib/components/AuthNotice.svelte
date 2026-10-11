<script lang="ts">
	/** The outcome of a sign-in attempt, from the `?auth=` value the callback redirects with. */
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

{#if message}
	<p class="notice" role="status">{message}</p>
{/if}

<style>
	.notice {
		margin-bottom: 20px;
		padding: 12px 14px;
		border: 2px solid var(--wrong-line);
		border-radius: 12px;
		background: var(--wrong-bg);
		color: var(--wrong-text);
		font-size: 14px;
		line-height: 20px;
	}
</style>
