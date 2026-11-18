<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { tick, untrack } from 'svelte';
	import { createLessonController, type LessonSource } from '$lib/lesson/controller.svelte';
	import { plainText } from '$lib/markdown/render';
	import { playAnswerSound, vibrateAnswer } from '$lib/preferences/feedback';
	import { initPreferences, preferences } from '$lib/preferences/store.svelte';
	import { shortcuts } from '$lib/settings/shortcuts.svelte';
	import Button from './Button.svelte';
	import FeedbackSheet from './FeedbackSheet.svelte';
	import FlagDialog from './FlagDialog.svelte';
	import Icon from './Icon.svelte';
	import Markdown from './Markdown.svelte';
	import OptionList from './OptionList.svelte';
	import ProblemCard from './ProblemCard.svelte';
	import SequenceBoard from './SequenceBoard.svelte';
	import ProgressHeader from './ProgressHeader.svelte';
	import QuitDialog from './QuitDialog.svelte';
	import SeeWhySheet from './SeeWhySheet.svelte';
	import Summary from './Summary.svelte';

	let { source, title, subtitle }: { source: LessonSource; title: string; subtitle: string } = $props();

	// Client-only lesson routes: read the stored mode before the first paint of Check.
	initPreferences();

	// The route re-creates this component per lesson, so the initial value is the one that matters.
	const lesson = createLessonController(untrack(() => source));

	let seeWhyOpen = $state(false);
	let whySeen = $state(false);
	let flagOpen = $state(false);
	let quitOpen = $state(false);
	let flagNote = $state('');
	let sheetHeight = $state(0);
	let heading: HTMLElement | undefined = $state();

	const screen = $derived(lesson.screen);
	const verdict = $derived(screen?.verdict ?? null);
	const whyGate = $derived(Boolean(screen?.seeWhy) && verdict !== null && !verdict.correct);

	let heard = '';

	function cue() {
		const current = lesson.screen?.verdict;
		if (!current) return;
		const token = `${lesson.stepKey}:${current.correct}`;
		if (heard === token) return;
		heard = token;
		if (preferences.sound) playAnswerSound(current.correct);
		if (preferences.haptics) vibrateAnswer(current.correct);
	}

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

	// `stepKey` reads a `$state.raw` object, so the getter re-runs on every answer.
	// Compare the string so focus and the Why? gate reset only for a new step.
	let headingStep = '';
	let whyStep = '';

	// New question or follow-up: move focus to its heading so the change is announced.
	$effect(() => {
		const key = lesson.stepKey;
		if (key === headingStep) return;
		headingStep = key;
		void tick().then(() => heading?.focus({ preventScroll: true }));
	});

	$effect(() => {
		const key = lesson.stepKey;
		if (key === whyStep) return;
		whyStep = key;
		whySeen = false;
		seeWhyOpen = false;
	});

	function proceed() {
		seeWhyOpen = false;
		lesson.advance();
		window.scrollTo({ top: 0 });
	}

	function openWhy() {
		whySeen = true;
		seeWhyOpen = true;
	}

	function onPrimary() {
		if (whyGate && !whySeen) openWhy();
		else proceed();
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
		if (lesson.pristine) void goto(resolve('/'));
		else quitOpen = true;
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
		if (!screen || seeWhyOpen || flagOpen || quitOpen) return;
		const target = event.target instanceof HTMLElement ? event.target : null;
		if (target?.closest('textarea, select, dialog')) return;

		// Number keys are single-character shortcuts, so the menu can switch them off (WCAG 2.1.4).
		if (shortcuts.enabled && /^[1-9]$/.test(event.key) && !verdict) {
			const option = screen.options[Number(event.key) - 1];
			if (option) {
				event.preventDefault();
				lesson.select(option.id);
				cue();
			}
			return;
		}
		if (event.key === 'Enter' && !target?.closest('button, a')) {
			event.preventDefault();
			if (verdict) {
				if (whyGate && !whySeen) openWhy();
				else proceed();
			} else if (screen.canCheck) {
				lesson.check();
				cue();
			}
		}
	}
</script>

<svelte:window {onkeydown} />

{#if lesson.summary}
	<Summary summary={lesson.summary} flags={lesson.flags} onretry={() => lesson.restart()} />
{:else if screen}
	<div class={['stage', { tap: screen.board !== null }]} style:--sheet-h="{verdict ? sheetHeight : 0}px">
		<ProgressHeader progress={lesson.progress} onclose={requestQuit} />

		<main>
			<header class="intro">
				<h1>{title}</h1>
				<p>{subtitle}</p>
			</header>

			{#if screen.stage === 'followUp'}
				<p class="followup-label"><Icon name="book" size={24} /> Follow-up</p>
				<div class="pinned followup-pinned"><ProblemCard prompt={screen.prompt} /></div>
				<h2 class="question" tabindex="-1" bind:this={heading}>
					<Markdown source={screen.followUpPrompt ?? ''} inline />
				</h2>
			{:else}
				<h2 class="question" tabindex="-1" bind:this={heading}>
					{screen.heading ?? 'Choose the best answer'}
				</h2>
				<div class="pinned"><ProblemCard prompt={screen.prompt} /></div>
			{/if}

			{#if screen.board}
				<div class="workspace">
					{#if screen.code}
						<div class="code-pane">
							<pre class="code"><code>{screen.code}</code></pre>
						</div>
					{/if}
					<div class="board-pane">
						{#key lesson.stepKey}
							<SequenceBoard
								presentation={screen.board.presentation}
								name={screen.board.name}
								cells={screen.board.cells}
								note={screen.board.note}
								locked={verdict !== null}
								onselect={(id) => {
									lesson.select(id);
									cue();
									// The sheet covers the bottom of a short landscape screen, so bring the
									// cell's explanation up above it. scroll-margin accounts for the sheet.
									void tick().then(() => {
										// Twice: the sheet's height lands after the first frame, and the page
										// padding grows to match it. The second scroll clears that cover.
										const reveal = () =>
											document.getElementById('cell-feedback')?.scrollIntoView({
												block: 'end',
												inline: 'nearest'
											});
										requestAnimationFrame(() => {
											reveal();
											requestAnimationFrame(reveal);
										});
									});
								}}
							/>
						{/key}
					</div>
				</div>
			{:else}
				<OptionList
					options={screen.options}
					selectedId={lesson.selectedId}
					locked={verdict !== null}
					legend={screen.stage === 'followUp' ? 'Follow-up answers' : 'Answers'}
					name={lesson.stepKey}
					onselect={(id) => {
						lesson.select(id);
						cue();
					}}
				/>
			{/if}
		</main>

		{#if !verdict && !preferences.immediateFeedback && !screen.board}
			<div class="footer">
				<Button
					disabled={!screen.canCheck}
					onclick={() => {
						lesson.check();
						cue();
					}}>Check</Button
				>
			</div>
		{/if}
	</div>

	{#if verdict}
		<FeedbackSheet
			tone={verdict.correct ? 'correct' : 'wrong'}
			title={verdict.correct ? 'Well done!' : 'Not quite.'}
			bind:height={sheetHeight}
			onflag={openFlag}
			onseewhy={whyGate && whySeen ? openWhy : undefined}
			primary={whyGate && !whySeen ? 'Why?' : 'Continue'}
			onprimary={onPrimary}
		>
			{#if screen.board && !verdict.correct}
				<p class="answer">
					The correct answer: <strong><Markdown source={verdict.correctText} inline /></strong>
				</p>
			{:else if verdict.correct}
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
	<QuitDialog open={quitOpen} onkeep={() => (quitOpen = false)} onquit={() => goto(resolve('/'))} />

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
		padding: 8.25px max(var(--gutter), env(safe-area-inset-right)) calc(24px + var(--sheet-h, 0px))
			max(var(--gutter), env(safe-area-inset-left));
	}

	/* The page's name and goal stay on screen for the whole sitting. */
	.intro {
		margin-bottom: 18px;
	}

	.intro h1 {
		font-size: 16px;
		font-weight: 800;
		line-height: 1.3;
	}

	.intro p {
		margin-top: 2px;
		color: var(--text-muted);
		font-size: 14px;
		line-height: 1.45;
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

	/* Portrait: the snippet sits above the sequence. Landscape: they share the row. */
	.workspace {
		display: flex;
		flex-direction: column;
		gap: 16px;
		min-width: 0;
	}

	.code-pane,
	.board-pane {
		min-width: 0;
	}

	.code {
		margin: 0;
		padding: 14px;
		overflow-x: auto;
		border: 2px solid var(--pre-line);
		border-radius: 12px;
		background: var(--pre-bg);
		color: var(--text);
		font-family: var(--mono);
		font-size: 13px;
		line-height: 1.55;
		white-space: pre;
		tab-size: 4;
	}

	@media (orientation: landscape) {
		.stage.tap {
			max-width: min(960px, 100%);
		}

		.stage.tap .intro {
			/* The question heading states the task. The title stays in the accessibility tree. */
			position: absolute;
			width: 1px;
			height: 1px;
			margin: -1px;
			padding: 0;
			overflow: hidden;
			clip: rect(0 0 0 0);
			white-space: nowrap;
			border: 0;
		}

		.stage.tap .question {
			margin-bottom: 8px;
		}

		.stage.tap .pinned {
			margin-bottom: 8px;
		}

		.workspace {
			display: grid;
			grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
			gap: 16px;
			align-items: start;
		}
	}

	.footer {
		padding: 12px max(var(--gutter), env(safe-area-inset-right)) max(24px, calc(env(safe-area-inset-bottom) + 14px))
			max(var(--gutter), env(safe-area-inset-left));
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
