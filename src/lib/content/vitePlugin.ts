import { join } from 'node:path';
import type { Plugin } from 'vite';
import { deckFiles, loadDecks } from './loadDecks.ts';

const VIRTUAL_ID = 'virtual:decks';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

/**
 * Compiles `content/decks/*.yaml` into the `virtual:decks` module.
 *
 * Validation happens here, so `pnpm dev`, `pnpm build`, and the test run all
 * fail with a file-and-path error when a deck breaks the content rules. The
 * client bundle receives plain JSON and never ships the YAML parser or zod.
 */
export function decksPlugin(contentDir = 'content/decks'): Plugin {
	let dir = contentDir;

	return {
		name: 'coding-drills:decks',
		configResolved(config) {
			dir = join(config.root, contentDir);
		},
		resolveId(id) {
			return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
		},
		load(id) {
			if (id !== RESOLVED_ID) return undefined;
			for (const file of deckFiles(dir)) this.addWatchFile(file);
			return `export const decks = ${JSON.stringify(loadDecks(dir))};\n`;
		},
		configureServer(server) {
			server.watcher.add(dir);
			const reload = (file: string) => {
				if (!file.startsWith(dir)) return;
				for (const environment of Object.values(server.environments)) {
					const mod = environment.moduleGraph.getModuleById(RESOLVED_ID);
					if (mod) environment.moduleGraph.invalidateModule(mod);
				}
				server.ws.send({ type: 'full-reload' });
			};
			server.watcher.on('change', reload).on('add', reload).on('unlink', reload);
		}
	};
}
