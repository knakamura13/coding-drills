import { describe, expect, it } from 'vitest';
import { KEYS, MAX_ATTEMPTS, Repository, flagId, type KeyValueStore } from './repository';
import { MAX_NOTE_LENGTH, type Attempt, type Flag } from './types';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Map<string, string> } {
	const data = new Map(Object.entries(initial));
	return {
		data,
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value)
	};
}

const brokenStore: KeyValueStore = {
	getItem() {
		throw new Error('blocked');
	},
	setItem() {
		throw new Error('blocked');
	}
};

const fixedNow = () => new Date(2026, 9, 10, 12, 0, 0, 0);
const AT = fixedNow().toISOString();

/** Ids that sort in creation order, so same-instant attempts keep their order. */
function counter(prefix = 'a') {
	let n = 0;
	return () => `${prefix}${String(++n).padStart(6, '0')}`;
}

const attempt = (questionId: string, correct = true) => ({
	deckId: 'deck',
	questionId,
	pickedId: 'a',
	correct
});

function remote(id: string, at = AT, questionId = 'q1'): Attempt {
	return { id, at, day: '2026-10-10', deckId: 'deck', questionId, pickedId: 'a', correct: true };
}

describe('attempts', () => {
	it('starts empty and records in order with an id, a timestamp, and the local day', () => {
		const repo = new Repository(memoryStore(), fixedNow, counter());
		expect(repo.attempts()).toEqual([]);
		repo.recordAttempt(attempt('q1'));
		repo.recordAttempt({ ...attempt('q2', false), followUp: { pickedId: 'x', correct: true } });
		expect(repo.attempts()).toEqual([
			{ id: 'a000001', at: AT, day: '2026-10-10', deckId: 'deck', questionId: 'q1', pickedId: 'a', correct: true },
			{
				id: 'a000002',
				at: AT,
				day: '2026-10-10',
				deckId: 'deck',
				questionId: 'q2',
				pickedId: 'a',
				correct: false,
				followUp: { pickedId: 'x', correct: true }
			}
		]);
	});

	it('persists to the store so a new repository sees the data', () => {
		const store = memoryStore();
		new Repository(store, fixedNow).recordAttempt(attempt('q1'));
		expect(new Repository(store).attempts()).toHaveLength(1);
	});

	it('gives attempts stored before ids existed a stable id and their local day', () => {
		const legacy = { at: '2026-10-10T12:00:00.000Z', deckId: 'd', questionId: 'q', pickedId: 'a', correct: true };
		const store = memoryStore({ [KEYS.attempts]: JSON.stringify([legacy]) });
		const first = new Repository(store).attempts();
		const second = new Repository(store).attempts();
		expect(first).toEqual(second);
		expect(first[0].id).toBe('legacy:2026-10-10T12:00:00.000Z:d:q');
		expect(first[0].day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it('keeps only the newest attempts beyond the cap, whichever device trims', () => {
		const many = Array.from({ length: MAX_ATTEMPTS + 5 }, (_, i) =>
			remote(`r${String(i).padStart(6, '0')}`, new Date(Date.UTC(2026, 0, 1, 0, 0, 0, i)).toISOString(), `q${i}`)
		);
		const repo = new Repository(memoryStore(), fixedNow);
		repo.applySync({ sentFlags: [], sent: [], cursor: 1, attempts: many, flags: [] });
		const attempts = repo.attempts();
		expect(attempts).toHaveLength(MAX_ATTEMPTS);
		expect(attempts[0].questionId).toBe('q5');
		expect(attempts.at(-1)!.questionId).toBe(`q${MAX_ATTEMPTS + 4}`);
	});

	it('ignores corrupted JSON and malformed entries', () => {
		const good = remote('g1');
		const badFollowUp = { ...good, id: 'g2', followUp: { pickedId: 1 } };
		const badTime = { ...good, id: 'g3', at: 'yesterday' };
		const missing = { at: AT };
		expect(new Repository(memoryStore({ [KEYS.attempts]: '{not json' })).attempts()).toEqual([]);
		expect(new Repository(memoryStore({ [KEYS.attempts]: '{"a":1}' })).attempts()).toEqual([]);
		expect(new Repository(memoryStore({ [KEYS.attempts]: '"text"' })).attempts()).toEqual([]);
		expect(
			new Repository(
				memoryStore({ [KEYS.attempts]: JSON.stringify([good, badFollowUp, badTime, missing, null, 7]) })
			).attempts()
		).toEqual([good]);
	});

	it('collapses duplicate ids and returns attempts in time order', () => {
		const late = remote('b', '2026-10-10T13:00:00.000Z');
		const early = remote('a', '2026-10-10T09:00:00.000Z');
		const store = memoryStore({ [KEYS.attempts]: JSON.stringify([late, early, early]) });
		expect(new Repository(store).attempts().map((a) => a.id)).toEqual(['a', 'b']);
	});
});

describe('sync bookkeeping', () => {
	it('treats the whole local history as pending before the first sync', () => {
		const repo = new Repository(memoryStore(), fixedNow, counter());
		repo.recordAttempt(attempt('q1'));
		repo.recordAttempt(attempt('q2'));
		expect(repo.syncState()).toEqual({ account: null, cursor: 0, pending: ['a000001', 'a000002'], pendingFlags: [] });
		expect(repo.pendingAttempts(1).map((a) => a.id)).toEqual(['a000001']);
	});

	it('stops treating attempts as pending once the server acknowledges them', () => {
		const repo = new Repository(memoryStore(), fixedNow, counter());
		repo.recordAttempt(attempt('q1'));
		repo.applySync({ sentFlags: [], sent: ['a000001'], cursor: 4, attempts: [], flags: [] });
		expect(repo.syncState()).toEqual({ account: null, cursor: 4, pending: [], pendingFlags: [] });
		repo.recordAttempt(attempt('q2'));
		expect(repo.syncState().pending).toEqual(['a000002']);
	});

	it('does not send attempts it just received from the server', () => {
		const repo = new Repository(memoryStore(), fixedNow, counter());
		repo.recordAttempt(attempt('q1'));
		const changed = repo.applySync({ sentFlags: [], sent: ['a000001'], cursor: 2, attempts: [remote('srv1')], flags: [] });
		expect(changed).toBe(true);
		expect(repo.attempts().map((a) => a.id)).toEqual(['a000001', 'srv1']);
		expect(repo.syncState().pending).toEqual([]);
	});

	it('reports no change when the server only repeats what is already held', () => {
		const repo = new Repository(memoryStore(), fixedNow, counter());
		repo.recordAttempt(attempt('q1'));
		const held = repo.attempts();
		expect(repo.applySync({ sentFlags: [], sent: [], cursor: 1, attempts: held, flags: [] })).toBe(false);
		expect(repo.attempts()).toEqual(held);
	});

	it('keeps only well-formed server records, without unknown keys, and counts only those as a change', () => {
		const store = memoryStore();
		const repo = new Repository(store, fixedNow);
		const good = remote('srv1');
		const flag: Flag = { id: 'f', at: AT, deckId: 'd', questionId: 'q', stage: 'question', note: 'n' };
		const response = {
			sent: [],
			sentFlags: [],
			cursor: 2,
			attempts: [{ ...good, junk: 'x' }, { ...remote('bad'), questionId: 'q\u0000' }] as Attempt[],
			flags: [{ ...flag, junk: 1 }, { ...flag, id: 'g', stage: 'later' }] as unknown as Flag[]
		};
		expect(repo.applySync(response)).toBe(true);
		expect(store.data.get(KEYS.attempts)).toBe(JSON.stringify([good]));
		expect(JSON.parse(store.data.get(KEYS.flags)!)).toEqual([flag]);
		expect(repo.applySync(response)).toBe(false);
	});

	it('does not let malformed server attempts push real ones past the cap', () => {
		const many = Array.from({ length: MAX_ATTEMPTS }, (_, i) =>
			remote(`r${String(i).padStart(6, '0')}`, new Date(Date.UTC(2026, 0, 1, 0, 0, 0, i)).toISOString(), `q${i}`)
		);
		const malformed = Array.from({ length: 5 }, (_, i) => ({ ...remote(`m${i}`, '2026-12-01T00:00:00.000Z'), pickedId: '' }));
		const repo = new Repository(memoryStore(), fixedNow);
		repo.applySync({ sentFlags: [], sent: [], cursor: 1, attempts: [...many, ...malformed], flags: [] });
		expect(repo.attempts()).toHaveLength(MAX_ATTEMPTS);
	});

	it('forgets a pending id whose attempt no longer reads back', () => {
		const good = remote('a1');
		const store = memoryStore({
			[KEYS.attempts]: JSON.stringify([good, { ...remote('a2'), questionId: 'q\u0000' }]),
			[KEYS.sync]: JSON.stringify({ cursor: 1, pending: ['a1', 'a2'] })
		});
		const repo = new Repository(store, fixedNow, counter('n'));
		repo.applySync({ sentFlags: [], sent: [], cursor: 1, attempts: [], flags: [] });
		expect(repo.syncState().pending).toEqual(['a1']);

		store.data.set(KEYS.sync, JSON.stringify({ cursor: 1, pending: ['a1', 'ghost'] }));
		repo.recordAttempt(attempt('q2'));
		expect(repo.syncState().pending).toEqual(['a1', 'n000001']);
	});

	it('counts every flag as pending before the first sync, and only edits and deletions after it', () => {
		const repo = new Repository(memoryStore(), fixedNow);
		const one = repo.upsertFlag({ deckId: 'd', questionId: 'q1', stage: 'question', note: 'a' });
		const two = repo.upsertFlag({ deckId: 'd', questionId: 'q2', stage: 'question', note: 'b' });
		expect(repo.syncState().pendingFlags).toEqual([one.id, two.id]);
		repo.applySync({ sent: [], sentFlags: [one, two], cursor: 1, attempts: [], flags: [one, two] });
		expect(repo.pendingFlags()).toEqual([]);
		repo.removeFlag(one.id);
		expect(repo.pendingFlags()).toMatchObject([{ id: one.id, removed: true }]);
	});

	it('keeps a flag pending when it changed after it was sent', () => {
		let now = new Date('2026-10-10T12:00:00.000Z');
		const repo = new Repository(memoryStore(), () => now);
		const sent = repo.upsertFlag({ deckId: 'd', questionId: 'q1', stage: 'question', note: 'a' });
		now = new Date('2026-10-10T12:01:00.000Z');
		const edited = repo.upsertFlag({ deckId: 'd', questionId: 'q1', stage: 'question', note: 'b' });
		repo.applySync({ sent: [], sentFlags: [sent], cursor: 1, attempts: [], flags: [sent] });
		expect(repo.pendingFlags()).toEqual([edited]);
	});

	it('keeps a flag pending when it changed in the same millisecond after it was sent', () => {
		const repo = new Repository(memoryStore(), fixedNow);
		const sent = repo.upsertFlag({ deckId: 'd', questionId: 'q1', stage: 'question', note: 'a' });
		const edited = repo.upsertFlag({ deckId: 'd', questionId: 'q1', stage: 'question', note: 'b' });
		expect(edited.at).toBe(sent.at);
		repo.applySync({ sent: [], sentFlags: [sent], cursor: 1, attempts: [], flags: [sent] });
		expect(repo.pendingFlags()).toEqual([edited]);
	});

	it('stops sending a local flag that a newer copy from the server replaced', () => {
		const repo = new Repository(memoryStore(), fixedNow);
		repo.applySync({ sent: [], sentFlags: [], cursor: 1, attempts: [], flags: [] });
		const local = repo.upsertFlag({ deckId: 'd', questionId: 'q1', stage: 'question', note: 'mine' });
		const newer: Flag = { ...local, at: '2027-01-01T00:00:00.000Z', note: 'theirs' };
		repo.applySync({ sent: [], sentFlags: [], cursor: 2, attempts: [], flags: [newer] });
		expect(repo.flags()).toEqual([newer]);
		expect(repo.pendingFlags()).toEqual([]);
	});

	it.each([-1, 1.5, 2 ** 31])('starts over from cursor 0 when the stored cursor is %s', (cursor) => {
		const store = memoryStore({ [KEYS.sync]: JSON.stringify({ cursor, pending: [], pendingFlags: [] }) });
		expect(new Repository(store).syncState().cursor).toBe(0);
	});

	it('keeps the largest valid stored cursor', () => {
		const store = memoryStore({ [KEYS.sync]: JSON.stringify({ cursor: 2 ** 31 - 1, pending: [], pendingFlags: [] }) });
		expect(new Repository(store).syncState().cursor).toBe(2 ** 31 - 1);
	});

	it('starts over for another account, and forgets the exchange on sign-out', () => {
		const flag: Flag = { id: 'f', at: AT, deckId: 'd', questionId: 'q', stage: 'question', note: 'n' };
		const store = memoryStore({
			[KEYS.attempts]: JSON.stringify([remote('a1')]),
			[KEYS.flags]: JSON.stringify([flag]),
			[KEYS.sync]: JSON.stringify({ account: 1, cursor: 9, pending: [], pendingFlags: [] })
		});
		const repo = new Repository(store);
		expect(repo.adoptAccount(1)).toBe(false);
		expect(repo.syncState().cursor).toBe(9);
		expect(repo.adoptAccount(2)).toBe(true);
		expect(repo.syncState()).toEqual({ account: 2, cursor: 0, pending: ['a1'], pendingFlags: ['f'] });
		repo.resetSync();
		expect(repo.syncState()).toEqual({ account: null, cursor: 0, pending: ['a1'], pendingFlags: ['f'] });
	});

	it('treats every flag as pending when the saved sync state predates pending flags', () => {
		const flag: Flag = { id: 'f', at: AT, deckId: 'd', questionId: 'q', stage: 'question', note: 'n' };
		const store = memoryStore({ [KEYS.flags]: JSON.stringify([flag]), [KEYS.sync]: JSON.stringify({ cursor: 3, pending: [] }) });
		expect(new Repository(store).syncState()).toEqual({ account: null, cursor: 3, pending: [], pendingFlags: ['f'] });
	});

	it('never moves the cursor backwards', () => {
		const repo = new Repository(memoryStore(), fixedNow);
		repo.applySync({ sentFlags: [], sent: [], cursor: 9, attempts: [], flags: [] });
		repo.applySync({ sentFlags: [], sent: [], cursor: 3, attempts: [], flags: [] });
		expect(repo.syncState().cursor).toBe(9);
	});
});

describe('flags', () => {
	const base = { deckId: 'deck', questionId: 'q1', stage: 'question' as const, note: '  Wrong claim.  ' };

	it('creates a flag with a deterministic id and a trimmed note', () => {
		const repo = new Repository(memoryStore(), fixedNow);
		const flag = repo.upsertFlag(base);
		expect(flag).toEqual({
			id: 'deck/q1/question',
			at: AT,
			deckId: 'deck',
			questionId: 'q1',
			stage: 'question',
			note: 'Wrong claim.'
		});
		expect(repo.flags()).toEqual([flag]);
	});

	it('replaces the note when the same target is flagged again', () => {
		const repo = new Repository(memoryStore(), fixedNow);
		repo.upsertFlag(base);
		repo.upsertFlag({ ...base, note: 'Better note.' });
		expect(repo.flags()).toHaveLength(1);
		expect(repo.flags()[0].note).toBe('Better note.');
	});

	it('keeps separate flags for the question and for each follow-up', () => {
		const repo = new Repository(memoryStore(), fixedNow);
		repo.upsertFlag(base);
		repo.upsertFlag({ ...base, stage: 'followUp', optionId: 'a' });
		repo.upsertFlag({ ...base, stage: 'followUp', optionId: 'b' });
		expect(repo.flags().map((flag) => flag.id)).toEqual([
			'deck/q1/question',
			'deck/q1/followUp:a',
			'deck/q1/followUp:b'
		]);
	});

	it('truncates very long notes', () => {
		const repo = new Repository(memoryStore(), fixedNow);
		expect(repo.upsertFlag({ ...base, note: 'x'.repeat(MAX_NOTE_LENGTH + 50) }).note).toHaveLength(
			MAX_NOTE_LENGTH
		);
	});

	it('saves a note the server can store, whatever was typed or pasted', () => {
		const repo = new Repository(memoryStore(), fixedNow);
		const flag = repo.upsertFlag({ ...base, note: 'pasted\u0000 text\ud83d\nsecond line' });
		expect(flag.note).toBe('pasted text�\nsecond line');
		expect(repo.flags()).toEqual([flag]);
	});

	it('removes a flag by id but keeps a tombstone so the deletion can sync', () => {
		const repo = new Repository(memoryStore(), fixedNow);
		const flag = repo.upsertFlag(base);
		repo.removeFlag(flag.id);
		expect(repo.flags()).toEqual([]);
		expect(repo.allFlags()).toEqual([{ ...flag, note: '', removed: true }]);
	});

	it('ignores removing a flag that does not exist', () => {
		const repo = new Repository(memoryStore(), fixedNow);
		repo.removeFlag('nope');
		expect(repo.allFlags()).toEqual([]);
	});

	it('drops malformed stored flags', () => {
		const good = { id: 'i', at: AT, deckId: 'd', questionId: 'q', stage: 'question', note: '' };
		const badStage = { ...good, stage: 'later' };
		const badOption = { ...good, optionId: 3 };
		const raw = JSON.stringify([good, badStage, badOption, 'x']);
		expect(new Repository(memoryStore({ [KEYS.flags]: raw })).flags()).toEqual([good]);
	});

	it('builds ids from the stage and option', () => {
		expect(flagId('d', 'q', 'question')).toBe('d/q/question');
		expect(flagId('d', 'q', 'followUp', 'a')).toBe('d/q/followUp:a');
		expect(flagId('d', 'q', 'followUp')).toBe('d/q/followUp:');
	});

	describe('merging from the server', () => {
		const older: Flag = { id: 'f', at: '2026-10-10T10:00:00.000Z', deckId: 'd', questionId: 'q', stage: 'question', note: 'old' };
		const newer: Flag = { ...older, at: '2026-10-10T11:00:00.000Z', note: 'new' };

		function withFlag(flag: Flag) {
			return new Repository(memoryStore({ [KEYS.flags]: JSON.stringify([flag]) }));
		}

		it('takes the newer copy', () => {
			const repo = withFlag(older);
			expect(repo.applySync({ sentFlags: [], sent: [], cursor: 0, attempts: [], flags: [newer] })).toBe(true);
			expect(repo.flags()[0].note).toBe('new');
		});

		it('keeps the local copy when it is newer or equal', () => {
			const repo = withFlag(newer);
			expect(repo.applySync({ sentFlags: [], sent: [], cursor: 0, attempts: [], flags: [older, newer] })).toBe(false);
			expect(repo.flags()[0].note).toBe('new');
		});

		it('applies a remote deletion that is newer than the local edit', () => {
			const repo = withFlag(older);
			const tombstone: Flag = { ...newer, note: '', removed: true };
			repo.applySync({ sentFlags: [], sent: [], cursor: 0, attempts: [], flags: [tombstone] });
			expect(repo.flags()).toEqual([]);
		});

		it('adds flags created on another device', () => {
			const repo = new Repository(memoryStore());
			repo.applySync({ sentFlags: [], sent: [], cursor: 0, attempts: [], flags: [older] });
			expect(repo.flags()).toEqual([older]);
		});
	});
});

describe('without usable storage', () => {
	it('keeps data in memory when there is no store', () => {
		const repo = new Repository(null, fixedNow);
		repo.recordAttempt(attempt('q1'));
		repo.upsertFlag({ deckId: 'd', questionId: 'q', stage: 'question', note: '' });
		expect(repo.attempts()).toHaveLength(1);
		expect(repo.flags()).toHaveLength(1);
	});

	it('keeps data in memory when the store throws', () => {
		const repo = new Repository(brokenStore, fixedNow);
		repo.recordAttempt(attempt('q1'));
		repo.upsertFlag({ deckId: 'd', questionId: 'q', stage: 'question', note: '' });
		expect(repo.attempts()).toHaveLength(1);
		expect(repo.flags()).toHaveLength(1);
	});
});
