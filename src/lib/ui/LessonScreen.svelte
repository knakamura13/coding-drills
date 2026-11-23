<!--
	The new lesson screen (FigCraft "Lesson screen" page), on the existing lesson controller. This
	version runs multiple-choice questions: top bar with progress, heading and prompt, answer tiles,
	and Check. After Check the footer becomes the feedback panel, and a follow-up opens with a
	recap of the question. The quit control asks first once anything has been answered. Phone first; from 1024px the same parts sit in a 640px column.
-->
<script lang="ts">
	import './theme.css';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { tick, untrack } from 'svelte';
	import { createLessonController, type LessonSource } from '$lib/lesson/controller.svelte';
	import { plainText } from '$lib/markdown/render';
	import AnswerTiles from './AnswerTiles.svelte';
	import Button from './Button.svelte';
	import FeedbackPanel from './FeedbackPanel.svelte';
	import LessonFooter from './LessonFooter.svelte';
	import LessonTopBar from './LessonTopBar.svelte';
	import Prose from './Prose.svelte';
	import RecapCard from './RecapCard.svelte';
	import Sheet from './Sheet.svelte';
	import { applyBranch, type BranchId } from './branch';

	let { title, branch, source }: { title: string; branch: BranchId | null; source: LessonSource } = $props();

	// The route re-creates this component per lesson, so the initial value is the one that matters.
	const lesson = createLessonController(untrack(() => source));
	const view = $derived(lesson.screen);

	// The panel explains the pick (lesson Round 5 dropped the separate Why? step): a right answer's
	// explanation, a wrong pick's own explanation, or the follow-up's explanation.
	const explanation = $derived(
		!view?.verdict
			? ''
			: view.stage === 'followUp' || view.verdict.correct
				? view.verdict.explanation
				: (view.seeWhy?.pickedExplanation ?? '')
	);

	// Spoken as soon as the panel appears. The panel moves focus to Continue, which on its own would
	// only announce the button.
	const announcement = $derived(
		!view?.verdict
			? ''
			: [
					view.verdict.correct ? 'Correct.' : 'Not quite.',
					view.verdict.correct ? '' : `The right answer: ${plainText(view.verdict.correctText, 300)}.`,
					plainText(explanation, 1000)
				]
					.filter(Boolean)
					.join(' ')
	);

	$effect(() => applyBranch(branch));

	let quitOpen = $state(false);
	let heading: HTMLElement | undefined = $state();

	// A new question or follow-up moves focus to its heading, so the change is announced. The first
	// question keeps the page's normal focus order.
	let shownStep = '';
	$effect(() => {
		const key = lesson.stepKey;
		if (key === shownStep) return;
		const first = shownStep === '';
		shownStep = key;
		if (!first) void tick().then(() => heading?.focus());
	});

	function leave() {
		void goto(resolve('/'));
	}

	function quit() {
		if (lesson.pristine) leave();
		else quitOpen = true;
	}

</script>

<div class="new-ui" data-new-ui>
<div class="lesson">
	{#if view}
		<div class="top">
			<div class="column">
				<LessonTopBar {title} total={view.total} done={view.position - 1} onquit={quit} />
			</div>
		</div>

		<main class="column content">
			{#if view.stage === 'followUp'}
				<p class="label">Follow-up</p>
				<RecapCard title={view.heading ?? 'The question'} prompt={view.prompt} picked={view.mainPickText ?? ''} />
				<h1 class="follow-up" tabindex="-1" bind:this={heading}>
					<Prose source={view.followUpPrompt ?? ''} />
				</h1>
			{:else}
				{#if view.heading}
					<h1 class="heading" tabindex="-1" bind:this={heading}>{view.heading}</h1>
				{:else}
					<!-- Some decks have no heading: the prompt is the question. Screen readers still get a
					     heading to land on, and the progress the screen shows only as segments. -->
					<h1 class="visually-hidden" tabindex="-1" bind:this={heading}>Question {view.position} of {view.total}</h1>
				{/if}
				<Prose source={view.prompt} />
			{/if}
			<AnswerTiles
				name="answer-{lesson.stepKey}"
				label={view.stage === 'followUp' ? (view.followUpPrompt ?? 'Follow-up') : (view.heading ?? 'Answers')}
				options={view.options}
				selectedId={lesson.selectedId}
				checked={Boolean(view.verdict)}
				onselect={(id) => lesson.select(id)}
			/>
		</main>

		<p class="visually-hidden" role="status">{announcement}</p>

		{#if view.verdict}
			<FeedbackPanel correct={view.verdict.correct} {explanation} oncontinue={() => lesson.advance()} />
		{:else}
			<LessonFooter>
				<Button disabled={!view.canCheck} onclick={() => lesson.check()}>Check</Button>
			</LessonFooter>
		{/if}
	{:else if lesson.summary}
		<!-- Temporary end state until the summary screen lands (lesson build, summary PR). -->
		<div class="top">
			<div class="column"><LessonTopBar title="Lesson complete" quitLabel="Close" onquit={leave} /></div>
		</div>
		<main class="column content">
			<h1 class="heading" tabindex="-1">{lesson.summary.correctFirstTry} of {lesson.summary.total} right the first time</h1>
		</main>
		<LessonFooter>
			<Button onclick={leave}>Done</Button>
			<Button variant="secondary" onclick={() => lesson.restart()}>Retry</Button>
		</LessonFooter>
	{/if}
</div>

<Sheet bind:open={quitOpen} title="Quit this lesson?">
	<p>Your answers so far are saved on this device. The lesson won't count as finished.</p>
	{#snippet actions()}
		<Button onclick={() => (quitOpen = false)}>Continue</Button>
		<Button variant="secondary" onclick={leave}>Quit</Button>
	{/snippet}
</Sheet>
</div>

<style>
	/* Marks the new UI for the old app.css, without adding a box. */
	.new-ui {
		display: contents;
	}

	.lesson {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
		background: var(--color-surface-page);
		color: var(--color-text-primary);
		font-family: var(--font-sans);
	}

	.column {
		width: 100%;
		max-width: 672px;
		margin: 0 auto;
		padding: 0 var(--space-screen-edge);
	}

	.top {
		position: sticky;
		top: 0;
		z-index: 1;
		background: var(--color-surface-page);
		padding-top: max(var(--space-4), env(safe-area-inset-top));
		padding-bottom: var(--space-4);
	}

	.content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding-top: var(--space-6);
		padding-bottom: var(--space-6);
	}

	.heading {
		font-size: var(--text-title-size);
		line-height: var(--text-title-line);
		font-weight: var(--text-title-weight);
		letter-spacing: var(--text-title-tracking);
		text-wrap: balance;
	}

	.label {
		color: var(--color-text-secondary);
		font-size: var(--text-label-size);
		line-height: var(--text-label-line);
		font-weight: var(--text-label-weight);
	}

	/* Follow-up A (lesson Round 5): the follow-up question at 18/24 SemiBold. */
	.follow-up {
		font-size: var(--text-heading-size);
		line-height: var(--text-heading-line);
		font-weight: var(--text-heading-weight);
	}

	.follow-up :global(.prose) {
		font-size: inherit;
		line-height: inherit;
	}

	h1:focus {
		outline: none;
	}
</style>
