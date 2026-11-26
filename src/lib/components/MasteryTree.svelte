<script lang="ts">
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import Markdown from '$lib/components/Markdown.svelte';
	import { plainText } from '$lib/markdown/render';
	import { PASS_RULE } from '$lib/domain/exam';
	import { EXAM_RULE, MASTERY_RULE, type CheckpointView, type SkillView, type TreeView } from '$lib/domain/mastery';

	let { tree, ready }: { tree: TreeView; ready: boolean } = $props();

	let selected = $state<string | null>(null);
	// The control that opened the detail. Escape returns focus there.
	let opener: HTMLButtonElement | null = null;

	async function toggle(id: string, button: HTMLButtonElement) {
		if (selected === id) {
			selected = null;
			opener = null;
			return;
		}
		selected = id;
		opener = button;
		await tick();
		document.getElementById(`detail-${id}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || selected === null) return;
		if (event.target instanceof Element && event.target.closest('dialog')) return;
		event.preventDefault();
		const button = opener;
		selected = null;
		opener = null;
		button?.focus();
	}

	const statusOf = (status: string) => (ready ? status : 'Loading');
</script>

<svelte:window {onkeydown} />

<main class="page tree" aria-busy={!ready}>
	<header class="intro">
		<h1>Mastery tree</h1>
		<p class="lede">Five branches leave a shared core. A path ends in a checkpoint, and a fork splits before it.</p>
		<details class="rule">
			<summary>How progress is decided</summary>
			<p>{MASTERY_RULE}</p>
			<p>{EXAM_RULE}</p>
			<p>Role-specific topics on the roadmap are not in this map yet. Nothing here changes the drills.</p>
		</details>
	</header>

	<nav class="constellation" aria-label="Branches">
		<div class="core">
			<span class="orb" class:mastered={ready && tree.state === 'mastered'} class:practicing={ready && tree.state === 'practicing'} aria-hidden="true"></span>
			<span class="name">Core</span>
			<span class="state">{statusOf(tree.status)}</span>
		</div>
		{#each tree.branches as branch (branch.id)}
			<a href="#branch-{branch.id}">
				<span
					class="orb"
					class:mastered={ready && branch.state === 'mastered'}
					class:practicing={ready && branch.state === 'practicing'}
					aria-hidden="true"
				></span>
				<span class="name"><Markdown inline source={branch.title} /></span>
				<span class="state">{statusOf(branch.status)}</span>
			</a>
		{/each}
	</nav>

	<div class="tree" id="tree">
		<ul class="legend">
			<li><span class="swatch" aria-hidden="true"></span> Not started</li>
			<li><span class="swatch practicing" aria-hidden="true"></span> Practicing</li>
			<li><span class="swatch mastered" aria-hidden="true"></span> Mastered</li>
			<li><span class="swatch exam locked" aria-hidden="true"></span> Locked exam</li>
			<li><span class="swatch exam available" aria-hidden="true"></span> Available exam</li>
			<li><span class="swatch exam passed" aria-hidden="true"></span> Passed exam</li>
		</ul>

		{#each tree.branches as branch (branch.id)}
			<section class="branch" aria-labelledby="branch-{branch.id}">
				<h2 id="branch-{branch.id}" tabindex="-1"><Markdown inline source={branch.title} /></h2>
				<p class="summary"><Markdown inline source={branch.summary} /></p>
				<div class="paths">
					{#each branch.paths as path (path.id)}
						<article class="path" id="path-{path.id}" aria-labelledby="path-{path.id}-title">
							<h3 id="path-{path.id}-title"><Markdown inline source={path.title} /></h3>
							<p class="summary"><Markdown inline source={path.summary} /></p>
							{#if path.after.length === 0}
								<p class="starts">Starts here</p>
							{:else}
								<p class="after-label" id="after-{path.id}">After</p>
								<ul class="prereqs" aria-labelledby="after-{path.id}">
									{#each path.after as prerequisite (prerequisite.id)}
										<li>
											<a class="prereq" class:cross={prerequisite.cross} class:done={ready && prerequisite.cleared} href="#path-{prerequisite.id}">
												<Markdown inline source={prerequisite.title} />
												{#if prerequisite.cross}
													<span class="from"><Markdown inline source={prerequisite.branchTitle} /></span>
												{/if}
											</a>
										</li>
									{/each}
								</ul>
							{/if}
							{#if path.afterNote}
								<p class="note"><Markdown inline source={path.afterNote} /></p>
							{/if}

							{@render skills(path.main)}
							{#if path.forks.length > 0}
								<div class="forks">
									{#each path.forks as fork (fork.id)}
										<div class="fork">
											<p class="fork-label" id="fork-{fork.id}">Fork · <Markdown inline source={fork.title} /></p>
											{@render skills(fork.skills)}
										</div>
									{/each}
								</div>
							{/if}
							{#each path.checkpoints as checkpoint (checkpoint.id)}
								{@render exam(checkpoint)}
							{/each}
						</article>
					{/each}
				</div>
			</section>
		{/each}
	</div>
</main>

{#snippet skills(nodes: readonly SkillView[])}
	<ol class="skills">
		{#each nodes as skill (skill.id)}
			<li id="skill-{skill.id}">
				<span class="edge" class:lit={ready && skill.lit} aria-hidden="true"></span>
				<button
					type="button"
					class="node"
					aria-expanded={selected === skill.id}
					aria-controls={selected === skill.id ? `detail-${skill.id}` : undefined}
					onclick={(event) => toggle(skill.id, event.currentTarget)}
				>
					<span class="mark {skill.state}" aria-hidden="true">
						{#if skill.state === 'mastered'}
							{@render check()}
						{:else if ready && skill.lockedBy.length > 0 && skill.state === 'unexplored'}
							{@render lock()}
						{/if}
					</span>
					<span class="copy">
						<span class="title"><Markdown inline source={skill.title} /></span>
						<span class="status">{statusOf(skill.status)}</span>
					</span>
				</button>
				{#if selected === skill.id}
					<div class="detail" id="detail-{skill.id}">
						{#if !ready}
							<p>Progress is still loading on this device.</p>
						{:else if skill.drills.length === 0}
							<p>No keep or rewrite drill is paired with this skill yet.</p>
						{:else}
							{#if skill.lockedBy.length > 0}
								<p>
									Locked until the checkpoint is passed on
									{#each skill.lockedBy as path, index (path.id)}{index > 0 ? ' and ' : ' '}<a href="#path-{path.id}"><Markdown inline source={path.title} /></a>{/each}.
								</p>
							{/if}
							<p>Paired by the curriculum map, or by list order where it names no skill. This is not a lesson assignment.</p>
							<ul class="facts">
								{#each skill.drills as drill (drill.questionId)}
									<li><code>{drill.questionId}</code> · {drill.dispositionLabel}</li>
								{/each}
							</ul>
							{#if skill.due > 0}
								<p>{skill.due} {skill.due === 1 ? 'drill is' : 'drills are'} due for review today.</p>
								<a class="practice" href={`${resolve('/review')}?skill=${skill.id}`}>Review this skill</a>
							{/if}
							{#if skill.lockedBy.length === 0}
								{#each skill.decks as deck (deck.deckId)}
									<a class="practice" href={resolve('/play/[deckId]', { deckId: deck.deckId })}>Practice in {deck.deckTitle}</a>
								{/each}
							{/if}
						{/if}
					</div>
				{/if}
			</li>
		{/each}
	</ol>
{/snippet}

{#snippet exam(checkpoint: CheckpointView)}
	<div class="exam-block" id="checkpoint-{checkpoint.id}">
		<span class="edge" class:lit={ready && checkpoint.lit} aria-hidden="true"></span>
		<button
			type="button"
			class="node exam"
			aria-expanded={selected === checkpoint.id}
			aria-controls={selected === checkpoint.id ? `detail-${checkpoint.id}` : undefined}
			onclick={(event) => toggle(checkpoint.id, event.currentTarget)}
		>
			<span class="mark exam-mark {checkpoint.state}" aria-hidden="true">
				{#if checkpoint.state === 'passed'}
					{@render check()}
				{:else if checkpoint.state === 'locked'}
					{@render lock()}
				{/if}
			</span>
			<span class="copy">
				<span class="kicker">Checkpoint</span>
				<span class="title"><Markdown inline source={checkpoint.title} /></span>
				<span class="status">{statusOf(checkpoint.status)}</span>
				{#if ready && checkpoint.remaining.length > 0}
					<span class="sr-only">Still needed: {checkpoint.remaining.map((skill) => plainText(skill.title)).join(', ')}.</span>
				{/if}
			</span>
		</button>
		{#if selected === checkpoint.id}
			<div class="detail" id="detail-{checkpoint.id}">
				<p><Markdown inline source={checkpoint.summary} /></p>
				{#if !ready}
					<p>Progress is still loading on this device.</p>
				{:else if checkpoint.state === 'locked'}
					<p>Locked until every skill below is mastered.</p>
					<ul class="facts">
						{#each checkpoint.remaining as skill (skill.id)}
							<li>
								<a href="#skill-{skill.id}"><Markdown inline source={skill.title} /></a>
								<span class="where"><Markdown inline source={skill.pathTitle} />{#if skill.branchTitle} · <Markdown inline source={skill.branchTitle} />{/if}</span>
							</li>
						{/each}
					</ul>
				{:else if checkpoint.state === 'available'}
					<p>Every skill that leads here is mastered. {PASS_RULE}</p>
					<a class="practice" href={resolve('/exam/[checkpointId]', { checkpointId: checkpoint.id })}>Start the exam</a>
				{:else}
					<p>Passed. A passed checkpoint stays passed.</p>
					<a class="practice" href={resolve('/exam/[checkpointId]', { checkpointId: checkpoint.id })}>Sit it again</a>
				{/if}
				{#if checkpoint.drills.length > 0}
					<p class="facts-label">Reserved exam drills</p>
					<ul class="facts">
						{#each checkpoint.drills as drill (drill.questionId)}
							<li><code>{drill.questionId}</code></li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}
	</div>
{/snippet}

{#snippet check()}
	<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
		<path d="M5 12.5l4.2 4.2L19 7.2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
	</svg>
{/snippet}

{#snippet lock()}
	<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
		<rect x="6" y="11" width="12" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="2" />
		<path d="M8.5 11V8.2a3.5 3.5 0 0 1 7 0V11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
	</svg>
{/snippet}

<style>
	h1 {
		font-size: 30px;
		font-weight: 800;
		line-height: 1.15;
	}

	h2,
	h3,
	p {
		margin: 0;
	}

	h2 {
		font-size: 22px;
		font-weight: 800;
		scroll-margin-top: calc(76px + env(safe-area-inset-top));
	}

	h3 {
		font-size: 17px;
		font-weight: 800;
	}

	.lede,
	.summary,
	.note,
	.starts,
	.after-label {
		color: var(--text-muted);
	}

	.lede {
		margin-top: 8px;
	}

	.rule {
		margin-top: 12px;
	}

	.rule summary {
		display: flex;
		align-items: center;
		min-height: 44px;
		font-weight: 800;
		cursor: pointer;
	}

	.rule p {
		margin-top: 8px;
		color: var(--text-muted);
	}

	.constellation {
		position: relative;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(104px, 1fr));
		justify-items: center;
		gap: 8px 4px;
		margin: 18px 0 8px;
	}

	.core {
		grid-column: 1 / -1;
		width: auto;
	}

	.constellation a,
	.core {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		width: min(100%, 156px);
		min-height: 44px;
		padding: 4px;
		border-radius: 12px;
		color: var(--text);
		font-weight: 800;
		line-height: 1.2;
		text-align: center;
		text-decoration: none;
	}

	.constellation a:hover {
		background: var(--accent-soft);
	}

	.orb {
		width: 64px;
		height: 64px;
		border: 3px solid var(--line);
		border-radius: 50%;
		background: var(--bg);
	}

	.orb.practicing {
		background: linear-gradient(to top, var(--accent) 50%, var(--bg) 50%);
		border-color: var(--accent-edge);
	}

	.orb.mastered {
		background: var(--right-btn);
		border-color: var(--right-edge);
	}

	.name {
		font-size: 13px;
		text-wrap: balance;
	}

	.state,
	.status {
		color: var(--text-muted);
		font-size: 12px;
		font-weight: 700;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 14px;
		margin: 12px 0 0;
		padding: 0;
		list-style: none;
		color: var(--text-muted);
		font-size: 13px;
		font-weight: 700;
	}

	.legend li {
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: 32px;
	}

	.swatch {
		width: 16px;
		height: 16px;
		border: 2px solid var(--line);
		border-radius: 50%;
		background: var(--bg);
	}

	.swatch.practicing {
		background: linear-gradient(to top, var(--accent) 50%, var(--bg) 50%);
		border-color: var(--accent-edge);
	}

	.swatch.mastered,
	.swatch.passed {
		background: var(--right-btn);
		border-color: var(--right-edge);
	}

	.swatch.exam {
		border-radius: 4px;
	}

	.swatch.locked {
		border-style: dashed;
	}

	.swatch.available {
		border-color: var(--followup);
		background: var(--accent-soft);
	}

	.branch {
		margin-top: 28px;
	}

	.paths {
		display: grid;
		gap: 12px;
		margin-top: 12px;
	}

	.path {
		padding: 12px;
		border: 2px solid var(--pre-line);
		border-radius: 16px;
		background: var(--pre-bg);
		scroll-margin-top: calc(76px + env(safe-area-inset-top));
	}

	.path .summary {
		margin-top: 4px;
		font-size: 14px;
	}

	.starts,
	.after-label,
	.note,
	.fork-label {
		margin-top: 8px;
		font-size: 13px;
		font-weight: 800;
	}

	.prereqs {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 6px 0 0;
		padding: 0;
		list-style: none;
	}

	.prereq {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		min-height: 44px;
		padding: 6px 12px;
		border: 2px solid var(--line);
		border-radius: 999px;
		background: var(--bg);
		color: var(--text);
		font-weight: 800;
		text-decoration: none;
	}

	.prereq.cross {
		border-style: dashed;
	}

	.prereq.done {
		border-color: var(--right-line);
		background: var(--right-bg);
	}

	.from {
		color: var(--text-muted);
		font-size: 12px;
		font-weight: 700;
	}

	.skills {
		margin: 4px 0 0;
		padding: 0;
		list-style: none;
	}

	.edge {
		display: block;
		width: 2px;
		height: 10px;
		margin-left: 25px;
		background: var(--line);
	}

	.edge.lit {
		background: var(--right-text);
		box-shadow: 0 0 6px var(--right-text);
	}

	.node {
		display: grid;
		grid-template-columns: 44px minmax(0, 1fr);
		gap: 10px;
		align-items: center;
		width: 100%;
		min-height: 44px;
		padding: 4px;
		border: 0;
		border-radius: 12px;
		background: transparent;
		color: inherit;
		font: inherit;
		letter-spacing: inherit;
		text-align: left;
		cursor: pointer;
	}

	.node:hover,
	.node[aria-expanded='true'] {
		background: var(--accent-soft);
	}

	.mark {
		display: grid;
		width: 44px;
		height: 44px;
		place-items: center;
		border: 2px solid var(--line);
		border-radius: 50%;
		background: var(--bg);
		color: var(--on-color);
	}

	.mark.practicing {
		background: linear-gradient(to top, var(--accent) 50%, var(--bg) 50%);
		border-color: var(--accent-edge);
	}

	.mark.mastered,
	.mark.passed {
		background: var(--right-btn);
		border-color: var(--right-edge);
	}

	.exam-mark {
		border-radius: 12px;
	}

	.mark.locked {
		border-style: dashed;
		color: var(--text-faint);
	}

	.mark.available {
		border-color: var(--followup);
		background: var(--accent-soft);
		color: var(--followup);
	}

	.copy {
		min-width: 0;
	}

	.title {
		display: block;
		font-weight: 800;
		line-height: 1.25;
		overflow-wrap: break-word;
	}

	.kicker {
		display: block;
		color: var(--text-muted);
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.forks {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 8px;
		margin: 8px 0 8px 18px;
		padding-left: 12px;
		border-left: 2px dashed var(--line);
	}

	.detail {
		margin: 4px 0 8px 54px;
		padding: 10px 12px;
		border: 2px solid var(--line);
		border-radius: 12px;
		background: var(--bg);
	}

	.detail p,
	.facts-label {
		margin-top: 8px;
	}

	.detail p:first-child,
	.facts-label:first-child {
		margin-top: 0;
	}

	.facts {
		margin: 6px 0 0;
		padding: 0;
		list-style: none;
	}

	.facts li {
		margin-top: 4px;
		overflow-wrap: anywhere;
	}

	.facts a {
		font-weight: 800;
	}

	.where {
		display: block;
		color: var(--text-muted);
		font-size: 13px;
	}

	.practice {
		display: flex;
		align-items: center;
		min-height: 44px;
		font-weight: 800;
	}

	code {
		font-family: var(--mono);
		font-size: 0.86em;
	}

	.page.tree {
		max-width: 1120px;
		padding-right: max(var(--gutter), env(safe-area-inset-right));
		padding-left: max(var(--gutter), env(safe-area-inset-left));
		padding-bottom: max(28px, env(safe-area-inset-bottom));
	}

	@media (min-width: 800px) {
		.paths {
			grid-template-columns: 1fr 1fr;
		}
	}

	@media (min-width: 1100px) {
		.paths {
			grid-template-columns: 1fr 1fr 1fr;
		}
	}

	/* Installed and browser iPhone landscape: a branch rail beside the tree.
	   Desktop windows are taller than this, so they keep the stacked map. */
	@media (orientation: landscape) and (max-height: 520px) and (max-width: 1100px) {
		:global(#content.bar) > .page.tree {
			padding-top: 6px;
		}

		.page.tree {
			display: grid;
			grid-template-areas:
				'intro intro'
				'nav tree';
			grid-template-columns: minmax(9.25rem, 34vw) minmax(0, 1fr);
			grid-template-rows: auto minmax(0, 1fr);
			column-gap: 12px;
			height: calc(100dvh - 52px - max(8px, env(safe-area-inset-top)));
			max-height: calc(100dvh - 52px - max(8px, env(safe-area-inset-top)));
			overflow: hidden;
			padding-bottom: 0;
		}

		.intro {
			grid-area: intro;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
		}

		h1 {
			font-size: 18px;
		}

		.lede {
			display: none;
		}

		.rule {
			margin: 0;
		}

		.legend {
			margin: 0 0 8px;
		}

		.legend li {
			min-height: 28px;
		}

		.constellation {
			grid-area: nav;
			display: flex;
			flex-direction: column;
			flex-wrap: nowrap;
			align-items: stretch;
			justify-content: flex-start;
			gap: 0;
			margin: 0;
			overflow-y: auto;
			overscroll-behavior: contain;
			padding-bottom: max(8px, env(safe-area-inset-bottom));
		}

		.core {
			grid-column: auto;
			width: auto;
		}

		.constellation a,
		.core {
			flex-direction: row;
			width: auto;
			min-height: 44px;
			padding-top: 0;
			padding-bottom: 0;
			gap: 8px;
			text-align: left;
		}

		.orb {
			width: 28px;
			height: 28px;
			flex: none;
		}

		.name {
			flex: 1;
			min-width: 0;
		}

		.tree {
			grid-area: tree;
			min-width: 0;
			overflow-y: auto;
			overscroll-behavior: contain;
			padding-bottom: max(12px, env(safe-area-inset-bottom));
		}

		.branch {
			margin-top: 16px;
		}

		.paths {
			grid-template-columns: 1fr;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.edge.lit {
			box-shadow: none;
		}
	}
</style>
