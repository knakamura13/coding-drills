<!--
	The new UI pieces on one page, for review against the FigCraft Components page and for the
	end-to-end and accessibility checks. Not linked from the app and not indexed. It sets its branch
	on <html> (applyBranch), so the sheets, which render outside <main>, follow it too.
-->
<script lang="ts">
	import '$lib/ui/theme.css';
	import Button from '$lib/ui/Button.svelte';
	import CodeBlock from '$lib/ui/CodeBlock.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import LessonFooter from '$lib/ui/LessonFooter.svelte';
	import LessonTopBar from '$lib/ui/LessonTopBar.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';
	import { applyBranch } from '$lib/ui/branch';

	const searchCode = `def search(a, t):
    lo, hi = 0, len(a) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if a[mid] == t:
            return mid`;

	const traceCode = `def pick(start):
    if len(path) == 2:
        out.append(path[:])
        return
    for j in range(start, len(items)):
        path.append(items[j])
        pick(j + 1)
        path.pop()`;

	let quitOpen = $state(false);
	let exampleOpen = $state(false);
	let quitCount = $state(0);

	$effect(() => applyBranch('sequences-and-search'));
</script>

<svelte:head>
	<title>UI pieces · Coding Drills</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="gallery">
	<h1>UI pieces</h1>
	<p class="note">The lesson building blocks from the FigCraft Components page. Branch: Sequences and search.</p>

	<section aria-labelledby="icons">
		<h2 id="icons">Icons</h2>
		<div class="row">
			<Icon name="close" label="Close" />
			<Icon name="correct" label="Correct" />
			<Icon name="missed" label="Missed" />
			<Icon name="chevron-down" label="Expand" />
			<Icon name="correct" small label="Correct" />
			<Icon name="missed" small label="Missed" />
		</div>
	</section>

	<section aria-labelledby="buttons">
		<h2 id="buttons">Buttons</h2>
		<div class="stack">
			<Button>Check</Button>
			<Button variant="secondary">Retry</Button>
			<Button disabled>Check</Button>
		</div>
	</section>

	<section aria-labelledby="code">
		<h2 id="code">Code block</h2>
		<div class="stack">
			<CodeBlock code={searchCode} />
			<CodeBlock code={traceCode} current={5} label="Code, line 5 running" />
		</div>
	</section>

	<section aria-labelledby="top-bar">
		<h2 id="top-bar">Top bar and progress</h2>
		<div class="stack">
			<LessonTopBar title="Boundary search" total={8} done={3} onquit={() => (quitOpen = true)} />
			<LessonTopBar title="Lesson complete" quitLabel="Close summary" onquit={() => quitCount++} />
		</div>
	</section>

	<section aria-labelledby="footer">
		<h2 id="footer">Footer</h2>
		<p class="note">Each box scrolls; the footer stays pinned to its bottom edge.</p>
		<div class="stack">
			<div class="frame" data-testid="footer-one">
				<p class="filler">Content scrolls under the footer. Which indices can still hold 11? The first probe reads a[3] = 18, so everything right of the probe is out.</p>
				<LessonFooter><Button>Check</Button></LessonFooter>
			</div>
			<div class="frame">
				<p class="filler">The summary ends with two actions.</p>
				<LessonFooter>
					<Button>Done</Button>
					<Button variant="secondary">Retry</Button>
				</LessonFooter>
			</div>
		</div>
	</section>

	<section aria-labelledby="sheets">
		<h2 id="sheets">Sheet and dialog</h2>
		<p class="note">A bottom sheet on phones, a centered dialog from 1024px wide.</p>
		<div class="stack">
			<Button variant="secondary" onclick={() => (quitOpen = true)}>Open the quit sheet</Button>
			<Button variant="secondary" onclick={() => (exampleOpen = true)}>Open the worked example</Button>
		</div>
	</section>
</main>

<Sheet bind:open={quitOpen} title="Quit this lesson?">
	<p>Your answers so far are saved on this device. The lesson won't count as finished.</p>
	{#snippet actions()}
		<Button onclick={() => (quitOpen = false)}>Continue</Button>
		<Button variant="secondary" onclick={() => (quitOpen = false)}>Quit</Button>
	{/snippet}
</Sheet>

<Sheet bind:open={exampleOpen} title="Worked example">
	<p>
		In the sorted list [1, 4, 6, 10, 12] with target 10, the first probe reads 6, too small. Because the list is
		sorted, 1 and 4 are smaller than 6 as well, so the search can drop the whole left side without looking at it.
	</p>
	<CodeBlock code={searchCode} />
	{#snippet actions()}
		<Button onclick={() => (exampleOpen = false)}>Close</Button>
	{/snippet}
</Sheet>

<style>
	.gallery {
		display: flex;
		flex-direction: column;
		gap: var(--space-8);
		max-width: 640px;
		min-height: 100dvh;
		margin: 0 auto;
		padding: var(--space-6) var(--space-screen-edge) var(--space-8);
		background: var(--color-surface-page);
		color: var(--color-text-primary);
		font-family: var(--font-sans);
	}

	h1 {
		font-size: var(--text-title-size);
		line-height: var(--text-title-line);
		font-weight: var(--text-title-weight);
	}

	h2 {
		margin-bottom: var(--space-3);
		font-size: var(--text-heading-size);
		line-height: var(--text-heading-line);
		font-weight: var(--text-heading-weight);
	}

	.note {
		margin-top: calc(-1 * var(--space-2));
		margin-bottom: var(--space-3);
		color: var(--color-text-secondary);
		font-size: var(--text-label-size);
		line-height: var(--text-label-line);
	}

	h1 + .note {
		margin: calc(-1 * var(--space-6)) 0 0;
	}

	.row {
		display: flex;
		align-items: center;
		gap: var(--space-6);
	}

	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.frame {
		height: 200px;
		overflow-y: auto;
		border: 1px solid var(--color-border-default);
		border-radius: var(--radius-card);
	}

	.filler {
		padding: var(--space-4) var(--space-screen-edge) 160px;
		color: var(--color-text-secondary);
	}
</style>
