<script lang="ts">
	import { MAX_NOTE_LENGTH } from '$lib/storage/types';
	import Button from './Button.svelte';
	import Dialog from './Dialog.svelte';

	interface Props {
		open: boolean;
		/** What is being flagged, for example the main question or a follow-up. */
		target: string;
		/** The existing note when this target was flagged before. */
		initialNote: string;
		onsave: (note: string) => void;
		onclose: () => void;
	}

	let { open, target, initialNote, onsave, onclose }: Props = $props();

	let note = $state('');

	$effect(() => {
		if (open) note = initialNote;
	});

	function submit(event: SubmitEvent) {
		event.preventDefault();
		onsave(note);
	}
</script>

<Dialog {open} label="Flag this question" {onclose}>
	<form onsubmit={submit}>
		<h2>Flag this question</h2>
		<p class="target">{target}</p>
		<label for="flag-note">What looks wrong? <span class="optional">(optional)</span></label>
		<textarea id="flag-note" bind:value={note} rows="4" maxlength={MAX_NOTE_LENGTH}></textarea>
		<p class="hint">
			Saved on this device. The summary screen can turn flags into GitHub issues on the public repo.
		</p>
		<div class="actions">
			<Button type="submit">Save flag</Button>
			<Button variant="outline" onclick={onclose}>Cancel</Button>
		</div>
	</form>
</Dialog>

<style>
	h2 {
		margin-top: 14px;
		font-size: 21px;
		font-weight: 800;
	}

	.target {
		margin-top: 4px;
		color: var(--text-muted);
		font-size: 15px;
	}

	label {
		display: block;
		margin-top: 18px;
		font-weight: 700;
	}

	.optional {
		color: var(--text-muted);
		font-weight: 400;
	}

	textarea {
		display: block;
		width: 100%;
		margin-top: 8px;
		padding: 12px 14px;
		border: 2px solid var(--line);
		border-radius: 14px;
		background: var(--bg);
		font-size: 16px;
		line-height: 1.5;
		resize: vertical;
	}

	textarea:focus-visible {
		border-color: var(--accent);
		outline-offset: 0;
	}

	.hint {
		margin-top: 10px;
		color: var(--text-muted);
		font-size: 14px;
	}

	.actions {
		display: grid;
		gap: 12px;
		margin-top: 20px;
		padding-bottom: 4px;
	}
</style>
