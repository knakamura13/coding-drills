import { Repository, type KeyValueStore } from './repository';

function browserStore(): KeyValueStore | null {
	try {
		if (typeof localStorage === 'undefined') return null;
		const probe = 'coding-drills:probe';
		localStorage.setItem(probe, '1');
		localStorage.removeItem(probe);
		return localStorage;
	} catch {
		return null;
	}
}

let repository: Repository | undefined;

/** The browser-backed repository. Call from the client only. */
export function getRepository(): Repository {
	repository ??= new Repository(browserStore());
	return repository;
}

export type { Attempt, Flag, FlagStage } from './types';
export { Repository, flagId } from './repository';
