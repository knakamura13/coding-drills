// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Repo, SessionUser } from '$lib/server/repo';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Null when this deployment has no database. */
			repo: Repo | null;
			user: SessionUser | null;
			sessionTokenHash: string | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
