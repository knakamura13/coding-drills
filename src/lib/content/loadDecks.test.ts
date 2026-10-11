import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ContentError, deckFiles, loadDecks, parseDeck } from './loadDecks.ts';

const MINIMAL_DECK = `
id: tiny
title: Tiny
description: Smallest valid deck.
questions:
  - id: q
    prompt: Pick one.
    options:
      - { id: a, text: A, explanation: Right. }
      - { id: b, text: B, explanation: Wrong. }
    correct: a
    followUps:
      b:
        prompt: Why not B?
        options:
          - { id: x, text: X }
          - { id: y, text: Y }
        correct: x
        explanation: X.
`;

const scratch: string[] = [];

function scratchDir(): string {
	const dir = mkdtempSync(join(tmpdir(), 'coding-drills-'));
	scratch.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('shipped decks', () => {
	const decks = loadDecks('content/decks');

	it('load and validate', () => {
		expect(decks.length).toBeGreaterThan(0);
	});

	it('give every wrong option a follow-up with at least two options', () => {
		for (const deck of decks) {
			for (const question of deck.questions) {
				const wrong = question.options.filter((option) => option.id !== question.correct);
				expect(Object.keys(question.followUps).sort()).toEqual(wrong.map((o) => o.id).sort());
				for (const followUp of Object.values(question.followUps)) {
					expect(followUp.options.length).toBeGreaterThanOrEqual(2);
				}
			}
		}
	});
});

describe('parseDeck', () => {
	it('parses a valid deck whose id matches the file name', () => {
		expect(parseDeck(MINIMAL_DECK, 'content/decks/tiny.yaml').id).toBe('tiny');
	});

	it('rejects a deck id that differs from the file name', () => {
		expect(() => parseDeck(MINIMAL_DECK, 'content/decks/other.yaml')).toThrow(
			'must match the file name "other"'
		);
	});

	it('reports invalid YAML with the file name', () => {
		expect(() => parseDeck('id: [unclosed', 'content/decks/bad.yaml')).toThrow(ContentError);
		expect(() => parseDeck('id: [unclosed', 'content/decks/bad.yaml')).toThrow(
			'content/decks/bad.yaml: invalid YAML'
		);
	});

	it('reports schema problems with file and path', () => {
		const broken = MINIMAL_DECK.replace('correct: a', 'correct: nope');
		expect(() => parseDeck(broken, 'content/decks/tiny.yaml')).toThrow(
			'content/decks/tiny.yaml: questions.0.correct'
		);
	});
});

describe('loadDecks', () => {
	it('reads only yaml files, sorted by name', () => {
		const dir = scratchDir();
		writeFileSync(join(dir, 'tiny.yaml'), MINIMAL_DECK);
		writeFileSync(join(dir, 'also.yml'), MINIMAL_DECK.replace('id: tiny', 'id: also'));
		writeFileSync(join(dir, 'notes.md'), '# not a deck');
		expect(deckFiles(dir).map((file) => file.split('/').pop())).toEqual(['also.yml', 'tiny.yaml']);
		expect(loadDecks(dir).map((deck) => deck.id)).toEqual(['also', 'tiny']);
	});

	it('rejects the same deck id in two files', () => {
		const dir = scratchDir();
		writeFileSync(join(dir, 'tiny.yaml'), MINIMAL_DECK);
		writeFileSync(join(dir, 'tiny.yml'), MINIMAL_DECK);
		expect(() => loadDecks(dir)).toThrow('duplicate deck id "tiny"');
	});
});
