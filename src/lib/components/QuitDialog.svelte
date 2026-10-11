<script lang="ts">
	import Button from './Button.svelte';
	import Dialog from './Dialog.svelte';

	let {
		open,
		onkeep,
		onquit
	}: { open: boolean; onkeep: () => void; onquit: () => void } = $props();
</script>

<Dialog {open} label="End this session?" onclose={onkeep}>
	<h2>End this session?</h2>
	<p>Answers so far are saved on this device, but the session will not be finished.</p>
	<div class="actions">
		<Button onclick={onkeep}>Keep going</Button>
		<Button variant="outline" onclick={onquit}>End session</Button>
	</div>
</Dialog>

<style>
	h2 {
		margin-top: 14px;
		font-size: 21px;
		font-weight: 800;
	}

	p {
		margin-top: 8px;
		color: var(--text-muted);
	}

	.actions {
		display: grid;
		gap: 12px;
		margin-top: 22px;
		padding-bottom: 4px;
	}
</style>
