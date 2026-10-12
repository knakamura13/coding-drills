import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deckFiles } from './loadDecks.ts';
import { basename, extname } from 'node:path';

/**
 * content/ROADMAP.md says where every topic stands as a deck. This keeps it
 * honest: a deck cannot ship without being listed, and a row cannot name a deck
 * that does not exist.
 */

const STATUSES = ['done', 'in review', 'partial', 'planned', 'out of scope'] as const;
const SHIPPED = new Set<string>(['done', 'in review', 'partial']);

interface Row {
	source: string;
	topic: string;
	deck: string | null;
	status: string;
}

function rows(markdown: string): Row[] {
	const result: Row[] = [];
	for (const line of markdown.split('\n')) {
		if (!line.startsWith('|')) continue;
		const cells = line
			.split('|')
			.slice(1, -1)
			.map((cell) => cell.trim());
		if (cells.length !== 4) continue;
		if (cells[0] === 'Source' || /^-+$/.test(cells[0])) continue;
		const deck = /^`([a-z0-9-]+)`$/.exec(cells[2])?.[1] ?? null;
		result.push({ source: cells[0], topic: cells[1], deck, status: cells[3] });
	}
	return result;
}

const markdown = readFileSync('content/ROADMAP.md', 'utf8');
const table = rows(markdown);
const decks = deckFiles('content/decks').map((file) => basename(file, extname(file)));

describe('content/ROADMAP.md', () => {
	it('has rows', () => {
		expect(table.length).toBeGreaterThan(20);
	});

	it('uses only the known statuses', () => {
		for (const row of table) expect(STATUSES, `${row.source}: ${row.status}`).toContain(row.status);
	});

	it('names an existing deck for every shipped row, and none for the rest', () => {
		for (const row of table) {
			const label = `${row.source} (${row.topic})`;
			if (SHIPPED.has(row.status)) {
				expect(row.deck, `${label} is ${row.status} but names no deck`).not.toBeNull();
				expect(decks, `${label} names a deck that does not exist`).toContain(row.deck);
			} else {
				expect(row.deck, `${label} is ${row.status} so it should name no deck`).toBeNull();
			}
		}
	});

	it('lists every deck that exists', () => {
		const listed = new Set(table.filter((row) => SHIPPED.has(row.status)).map((row) => row.deck));
		for (const deck of decks) expect(listed, `${deck} is not in the roadmap`).toContain(deck);
	});

	it('marks a deck "done" only where no row for it is still in review', () => {
		// A deck that is still in review cannot also be called done elsewhere.
		for (const deck of decks) {
			const statuses = new Set(table.filter((row) => row.deck === deck).map((row) => row.status));
			expect(statuses.has('in review') && statuses.has('done'), `${deck} is both done and in review`).toBe(false);
		}
	});
});
