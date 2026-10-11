import type { Repo, SessionUser } from '$lib/server/repo';
import { newestFlags } from '$lib/server/repo';
import { SYNC_PAGE } from '$lib/sync/protocol';
import type { Attempt, Flag } from '$lib/storage/types';

/**
 * An in-memory `Repo` for tests of the routes and the sync engine. It follows
 * the same contract as the SQL implementation, and `repo.integration.test.ts`
 * runs both through the same suite so they cannot drift apart.
 */
export function createMemoryRepo(): Repo {
	let nextUserId = 1;
	const users = new Map<string, SessionUser & { sub: string }>();
	const sessions = new Map<string, { userId: number; expiresAt: Date }>();
	const attempts = new Map<number, { seq: number; attempt: Attempt }[]>();
	const flags = new Map<number, Map<string, Flag>>();
	let seq = 0;

	return {
		async upsertUser(sub, email, name) {
			const held = users.get(sub);
			const user = { id: held?.id ?? nextUserId++, sub, email, name };
			users.set(sub, user);
			return { id: user.id, email, name };
		},
		async createSession(tokenHash, userId, expiresAt) {
			sessions.set(tokenHash, { userId, expiresAt });
		},
		async userForSession(tokenHash, now) {
			const session = sessions.get(tokenHash);
			if (!session || session.expiresAt <= now) return null;
			const user = [...users.values()].find((candidate) => candidate.id === session.userId);
			if (!user) return null;
			return { user: { id: user.id, email: user.email, name: user.name }, expiresAt: session.expiresAt };
		},
		async extendSession(tokenHash, expiresAt) {
			const session = sessions.get(tokenHash);
			if (session) session.expiresAt = expiresAt;
		},
		async deleteSession(tokenHash) {
			sessions.delete(tokenHash);
		},
		async sync(userId, request) {
			const mine = attempts.get(userId) ?? [];
			attempts.set(userId, mine);
			const held = new Set(mine.map((entry) => entry.attempt.id));
			for (const attempt of request.attempts) {
				if (held.has(attempt.id)) continue;
				held.add(attempt.id);
				mine.push({ seq: ++seq, attempt });
			}

			const myFlags = flags.get(userId) ?? new Map<string, Flag>();
			flags.set(userId, myFlags);
			for (const flag of newestFlags(request.flags)) {
				const existing = myFlags.get(flag.id);
				if (!existing || flag.at > existing.at) myFlags.set(flag.id, flag);
			}

			const after = mine.filter((entry) => entry.seq > request.cursor).sort((a, b) => a.seq - b.seq);
			const more = after.length > SYNC_PAGE;
			const page = more ? after.slice(0, SYNC_PAGE) : after;
			return {
				cursor: page.length > 0 ? page[page.length - 1].seq : request.cursor,
				attempts: page.map((entry) => entry.attempt),
				flags: [...myFlags.values()],
				more
			};
		}
	};
}
