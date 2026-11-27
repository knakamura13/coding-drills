import { join } from 'node:path';
import type { Plugin } from 'vite';
import { depthMap } from './depth.ts';
import { curriculumFiles, loadCurriculum } from './loadCurriculum.ts';
import { deckFiles, loadDecks } from './loadDecks.ts';
import type { Deck, DeckSummary } from './schema.ts';

/**
 * Compiles `content/decks/*.yaml` into virtual modules, so each page loads only what it uses:
 *
 *   virtual:deck-index    every deck without its prompts and options (menu, home, decks, progress)
 *   virtual:deck-loaders  one lazy import per deck id (a lesson loads its own deck and nothing else)
 *   virtual:deck/<id>     one deck in full, behind that lazy import
 *   virtual:decks         every deck in full (the routes that mix decks, and the server)
 *   virtual:curriculum    the mastery map (branches, skills, checkpoints, drill decisions)
 *   virtual:depths        question id to depth for questions deeper than the default (deck-shaped views at a level)
 *
 * Validation happens here, so `pnpm dev`, `pnpm build`, and the test run all
 * fail with a file-and-path error when a deck breaks the content rules. The
 * client bundle never ships the YAML parser or zod.
 */

const INDEX = 'virtual:deck-index';
const LOADERS = 'virtual:deck-loaders';
const ALL = 'virtual:decks';
const CURRICULUM = 'virtual:curriculum';
const DEPTHS = 'virtual:depths';
const DECK_PREFIX = 'virtual:deck/';

const isVirtual = (id: string) =>
	id === INDEX || id === LOADERS || id === ALL || id === CURRICULUM || id === DEPTHS || id.startsWith(DECK_PREFIX);

function summarize(deck: Deck): DeckSummary {
	return {
		id: deck.id,
		title: deck.title,
		description: deck.description,
		questions: deck.questions.map((question) => ({
			id: question.id,
			...(question.tags ? { tags: question.tags } : {})
		}))
	};
}

export function decksPlugin(contentDir = 'content/decks', curriculumContentDir = 'content/curriculum'): Plugin {
	let dir = contentDir;
	let curriculumDir = curriculumContentDir;
	// Parsed once, then again only after a deck file changes.
	let parsed: Deck[] | null = null;
	const decks = () => (parsed ??= loadDecks(dir));

	return {
		name: 'coding-drills:decks',
		configResolved(config) {
			dir = join(config.root, contentDir);
			curriculumDir = join(config.root, curriculumContentDir);
		},
		buildStart() {
			parsed = null;
			// Fail the build here, not only when a page imports the map.
			loadCurriculum(curriculumDir, dir);
		},
		resolveId(id) {
			return isVirtual(id) ? `\0${id}` : undefined;
		},
		load(id) {
			if (!id.startsWith('\0virtual:')) return undefined;
			const name = id.slice(1);
			if (name === CURRICULUM || name === DEPTHS) {
				for (const file of curriculumFiles(curriculumDir)) this.addWatchFile(file);
				const curriculum = loadCurriculum(curriculumDir, dir);
				if (name === DEPTHS) return `export const depths = ${JSON.stringify(depthMap(curriculum))};\n`;
				return `export const curriculum = ${JSON.stringify(curriculum)};\n`;
			}
			for (const file of deckFiles(dir)) this.addWatchFile(file);

			if (name === INDEX) {
				return `export const decks = ${JSON.stringify(decks().map(summarize))};\n`;
			}
			if (name === LOADERS) {
				const entries = decks().map(
					(deck) => `\t${JSON.stringify(deck.id)}: () => import(${JSON.stringify(DECK_PREFIX + deck.id)})`
				);
				return `export const loaders = {\n${entries.join(',\n')}\n};\n`;
			}
			if (name === ALL) {
				const imports = decks().map(
					(deck, index) => `import { deck as deck${index} } from ${JSON.stringify(DECK_PREFIX + deck.id)};`
				);
				const list = decks().map((_, index) => `deck${index}`);
				return `${imports.join('\n')}\nexport const decks = [${list.join(', ')}];\n`;
			}
			const deck = decks().find((candidate) => DECK_PREFIX + candidate.id === name);
			return deck ? `export const deck = ${JSON.stringify(deck)};\n` : undefined;
		},
		configureServer(server) {
			server.watcher.add(dir);
			server.watcher.add(curriculumDir);
			const reload = (file: string) => {
				const deckChange = file.startsWith(dir);
				const curriculumChange = file.startsWith(curriculumDir);
				if (!deckChange && !curriculumChange) return;
				const ids = [
					INDEX,
					LOADERS,
					ALL,
					CURRICULUM,
					DEPTHS,
					...(parsed ?? []).map((deck) => DECK_PREFIX + deck.id)
				];
				parsed = null;
				for (const environment of Object.values(server.environments)) {
					for (const id of ids) {
						const mod = environment.moduleGraph.getModuleById(`\0${id}`);
						if (mod) environment.moduleGraph.invalidateModule(mod);
					}
				}
				server.ws.send({ type: 'full-reload' });
			};
			server.watcher.on('change', reload).on('add', reload).on('unlink', reload);
		}
	};
}
