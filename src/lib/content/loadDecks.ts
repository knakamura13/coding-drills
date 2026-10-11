import { readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { parse } from 'yaml';
import { deckSchema, formatIssues, type Deck } from './schema.ts';

/** Node-only. Reads, parses, and validates deck files at build and test time. */

export class ContentError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ContentError';
	}
}

export function deckFiles(dir: string): string[] {
	return readdirSync(dir)
		.filter((name) => /\.ya?ml$/.test(name))
		.sort()
		.map((name) => join(dir, name));
}

export function parseDeck(source: string, file: string): Deck {
	let raw: unknown;
	try {
		raw = parse(source);
	} catch (error) {
		throw new ContentError(`${file}: invalid YAML: ${(error as Error).message}`);
	}
	const result = deckSchema.safeParse(raw);
	if (!result.success) throw new ContentError(formatIssues(file, result.error.issues));
	const stem = basename(file, extname(file));
	if (result.data.id !== stem) {
		throw new ContentError(`${file}: deck id "${result.data.id}" must match the file name "${stem}"`);
	}
	return result.data;
}

export function loadDecks(dir: string): Deck[] {
	const decks = deckFiles(dir).map((file) => parseDeck(readFileSync(file, 'utf8'), file));
	const seen = new Set<string>();
	for (const deck of decks) {
		if (seen.has(deck.id)) throw new ContentError(`duplicate deck id "${deck.id}" in ${dir}`);
		seen.add(deck.id);
	}
	return decks;
}
