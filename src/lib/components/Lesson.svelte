<script lang="ts">
	import { goto } from '$app/navigation';
	import { tick, untrack } from 'svelte';
	import { createLessonController, type LessonSource } from '$lib/lesson/controller.svelte';
	import { plainText } from '$lib/markdown/render';
	import Button from './Button.svelte';
	import FeedbackSheet from './FeedbackSheet.svelte';
	import FlagDialog from './FlagDialog.svelte';
	import Icon from './Icon.svelte';
	import Markdown from './Markdown.svelte';
	import OptionList from './OptionList.svelte';
	import ProblemCard from './ProblemCard.svelte';
	import ProgressHeader from './ProgressHeader.svelte';
	import QuitDialog from './QuitDialog.svelte';
	import SeeWhySheet from './SeeWhySheet.svelte';
	import Summary from './Summary.svelte';

	let { source }: { source: LessonSource } = $props();

	// The route re-creates this component per lesson, so the initial value is the one that matters.
	const lesson = createLessonController(untrack(() => source));

	let seeWhyOpen = $state(false);
	let flagOpen = $state(false);
	let quitOpen = $state(false);
	let flagNote = $state('');
	let sheetHeight = $state(0);
	let heading: HTMLElement | undefined = $state();

	const screen = $derived(lesson.screen);
	const verdict = $derived(screen?.verdict ?? null);

	const announcement = $derived(
		verdict
			? [
					verdict.correct ? 'Correct.' : `Not quite. The correct answer is ${plainText(verdict.correctText)}.`,
					plainText(verdict.explanation, 400)
				]
					.join(' ')
					.trim()
			: ''
	);

	// New question or follow-up: move focus to its heading so the change is announced.
	$effect(() => {
		void lesson.stepKey;
		void tick().then(() => heading?.focus({ preventScroll: true }));
	});

	function proceed() {
		seeWhyOpen = false;
		lesson.advance();
		window.scrollTo({ top: 0 });
	}

	function openFlag() {
		flagNote = lesson.flagNote;
		flagOpen = true;
	}

	function saveFlag(note: string) {
		lesson.flag(note);
		flagOpen = false;
	}

	function requestQuit() {
		if (lesson.pristine) void goto('/');
		else quitOpen = true;
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
		if (!screen || seeWhyOpen || flagOpen || quitOpen) return;
		const target = event.target instanceof HTMLElement ? event.target : null;
		if (target?.closest('textarea, select, dialog')) return;

		if (/^[1-9]$/.test(event.key) && !verdict) {
			const option = screen.options[Number(event.key) - 1];
			if (option) {
				event.preventDefault();
				lesson.select(option.id);
			}
			return;
		}
		if (event.key === 'Enter' && !target?.closest('button, a')) {
			event.preventDefault();
			if (verdict) proceed();
			else if (screen.canCheck) lesson.check();
		}
	}
</script>

<svelte:window {onkeydown} />

{#if lesson.summary}
	<Summary summary={lesson.summary} flags={lesson.flags} onretry={() => lesson.restart()} />
{:else if screen}
	<div class="stage" style:--sheet-h="{verdict ? sheetHeight : 0}px">
		<ProgressHeader progress={lesson.progress} onclose={requestQuit} />

		<main>
			{#if screen.stage === 'followUp'}
				<p class="followup-label"><Icon name="book" size={24} /> Follow-up</p>
				<div class="pinned followup-pinned"><ProblemCard prompt={screen.prompt} /></div>
				<h1 class="question" tabindex="-1" bind:this={heading}>
					<Markdown source={screen.followUpPrompt ?? ''} inline />
				</h1>
			{:else}
				<h1 class="question" tabindex="-1" bind:this={heading}>
					{screen.heading ?? 'Choose the best answer'}
				</h1>
				<div class="pinned"><ProblemCard prompt={screen.prompt} /></div>
			{/if}

			<OptionList
				options={screen.options}
				selectedId={lesson.selectedId}
				locked={verdict !== null}
				legend={screen.stage === 'followUp' ? 'Follow-up answers' : 'Answers'}
				name={lesson.stepKey}
				onselect={(id) => lesson.select(id)}
			/>
		</main>

		{#if !verdict}
			<div class="footer">
				<Button disabled={!screen.canCheck} onclick={() => lesson.check()}>Check</Button>
			</div>
		{/if}
	</div>

	{#if verdict}
		<FeedbackSheet
			tone={verdict.correct ? 'correct' : 'wrong'}
			title={verdict.correct ? 'Well done!' : 'Not quite.'}
			bind:height={sheetHeight}
			onflag={openFlag}
			onseewhy={screen.seeWhy ? () => (seeWhyOpen = true) : undefined}
			oncontinue={proceed}
		>
			{#if verdict.correct}
				<Markdown source={verdict.explanation} />
			{:else}
				<p class="answer">
					The correct answer: <strong><Markdown source={verdict.correctText} inline /></strong>
				</p>
				{#if verdict.explanation}
					<div class="why"><Markdown source={verdict.explanation} /></div>
				{/if}
			{/if}
		</FeedbackSheet>
	{/if}

	<SeeWhySheet open={seeWhyOpen} why={screen.seeWhy} onclose={() => (seeWhyOpen = false)} />
	<FlagDialog
		open={flagOpen}
		target={lesson.flagLabel}
		initialNote={flagNote}
		onsave={saveFlag}
		onclose={() => (flagOpen = false)}
	/>
	<QuitDialog open={quitOpen} onkeep={() => (quitOpen = false)} onquit={() => goto('/')} />

	<div class="sr-only" role="status" aria-live="polite">{announcement}</div>
{/if}

<style>
	.stage {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
		max-width: var(--column);
		margin: 0 auto;
	}

	main {
		flex: 1;
		padding: 8.25px var(--gutter) calc(24px + var(--sheet-h, 0px));
	}

	/* The lesson heading: 19px bold, one 26.6px line. The reference sets the glyphs 1px lower in
	   the line than centered CSS does, so the heading is nudged down and its gap below trimmed. */
	.question {
		margin-top: 0.9px;
		margin-bottom: 15.6px;
		font-size: 19px;
		font-weight: 700;
		line-height: 26.6px;
		letter-spacing: 0.3px;
		outline: none;
	}

	.pinned {
		margin-bottom: 15.4px;
	}

	/* The follow-up question sits under the pinned problem and is set a size smaller. */
	.followup-pinned {
		margin-bottom: 14.9px;
	}

	.followup-pinned + .question {
		margin-top: 0;
		margin-bottom: 15.15px;
		font-size: 17px;
		line-height: 25px;
		letter-spacing: 0.35px;
	}

	/* The book glyph's ink sits inside a 24px box, so pull its box out to the gutter. */
	.followup-label {
		display: flex;
		align-items: center;
		gap: 2.95px;
		height: 20px;
		margin-top: 0.46px;
		margin-bottom: 14.14px;
		color: var(--followup);
		font-size: 13px;
		font-weight: 700;
		line-height: 20px;
		letter-spacing: 0.57px;
		text-transform: uppercase;
	}

	.followup-label :global(svg) {
		flex: none;
		margin: -0.35px 0 0 -3.9px;
	}

	.footer {
		padding: 12px var(--gutter) max(24px, calc(env(safe-area-inset-bottom) + 14px));
	}

	/* The whole answer line is bold, not just the answer. */
	.answer {
		font-weight: 700;
	}

	.answer strong {
		font-weight: inherit;
	}

	.why {
		margin-top: 8px;
	}
</style>
