import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { loadDecks } from '../content/loadDecks.ts';
import { loadCurriculum } from '../content/loadCurriculum.ts';
import { projectCurriculum } from '../domain/mastery.ts';
import MasteryTree from './MasteryTree.svelte';

const curriculum = loadCurriculum('content/curriculum', 'content/decks');
const deckTitles = new Map(loadDecks('content/decks').map((deck) => [deck.id, deck.title]));
const tree = projectCurriculum(curriculum, [], deckTitles, '2026-01-01');

describe('MasteryTree text', () => {
	const { body } = render(MasteryTree, { props: { tree, ready: true } });

	it('has curriculum text with inline code to render', () => {
		const notes = tree.branches.flatMap((branch) => branch.paths.map((path) => path.afterNote ?? ''));
		expect(notes.some((note) => note.includes('`'))).toBe(true);
	});

	it('renders inline code in a path note as code, not literal backticks', () => {
		const note = tree.branches.flatMap((branch) => branch.paths).find((path) => path.afterNote?.includes('`frontier.pop()`'))?.afterNote;
		expect(note).toBeDefined();
		expect(body).toContain('<code>frontier.pop()</code>');
		expect(body).not.toContain('`frontier.pop()`');
	});

	it('leaves no literal backtick pair in the printed tree', () => {
		expect(body).not.toMatch(/`[^`\n]+`/);
	});

	it('never injects raw HTML from content', () => {
		const html = render(MasteryTree, {
			props: {
				tree: {
					...tree,
					branches: tree.branches.map((branch, index) =>
						index === 0 ? { ...branch, summary: 'Use `<b>x</b>` <img src=x onerror=alert(1)>' } : branch
					)
				},
				ready: true
			}
		}).body;
		expect(html).toContain('<code>&lt;b&gt;x&lt;/b&gt;</code>');
		expect(html).not.toContain('<img src=x');
	});
});
