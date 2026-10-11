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
		repo.applySync({ sent: [], cursor: 1, attempts: many, flags: [] });
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
		expect(repo.syncState()).toEqual({ cursor: 0, pending: ['a000001', 'a000002'] });
		expect(repo.pendingAttempts(1).map((a) => a.id)).toEqual(['a000001']);
	});

	it('stops treating attempts as pending once the server acknowledges them', () => {
		const repo = new Repository(memoryStore(), fixedNow, counter());
		repo.recordAttempt(attempt('q1'));
		repo.applySync({ sent: ['a000001'], cursor: 4, attempts: [], flags: [] });
		expect(repo.syncState()).toEqual({ cursor: 4, pending: [] });
		repo.recordAttempt(attempt('q2'));
		expect(repo.syncState().pending).toEqual(['a000002']);
	});

	it('does not send attempts it just received from the server', () => {
		const repo = new Repository(memoryStore(), fixedNow, counter());
		repo.recordAttempt(attempt('q1'));
		const changed = repo.applySync({ sent: ['a000001'], cursor: 2, attempts: [remote('srv1')], flags: [] });
		expect(changed).toBe(true);
		expect(repo.attempts().map((a) => a.id)).toEqual(['a000001', 'srv1']);
		expect(repo.syncState().pending).toEqual([]);
	});

	it('reports no change when the server only repeats what is already held', () => {
		const repo = new Repository(memoryStore(), fixedNow, counter());
		repo.recordAttempt(attempt('q1'));
		const held = repo.attempts();
		expect(repo.applySync({ sent: [], cursor: 1, attempts: held, flags: [] })).toBe(false);
		expect(repo.attempts()).toEqual(held);
	});

	it('never moves the cursor backwards', () => {
		const repo = new Repository(memoryStore(), fixedNow);
		repo.applySync({ sent: [], cursor: 9, attempts: [], flags: [] });
		repo.applySync({ sent: [], cursor: 3, attempts: [], flags: [] });
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
			expect(repo.applySync({ sent: [], cursor: 0, attempts: [], flags: [newer] })).toBe(true);
			expect(repo.flags()[0].note).toBe('new');
		});

		it('keeps the local copy when it is newer or equal', () => {
			const repo = withFlag(newer);
			expect(repo.applySync({ sent: [], cursor: 0, attempts: [], flags: [older, newer] })).toBe(false);
			expect(repo.flags()[0].note).toBe('new');
		});

		it('applies a remote deletion that is newer than the local edit', () => {
			const repo = withFlag(older);
			const tombstone: Flag = { ...newer, note: '', removed: true };
			repo.applySync({ sent: [], cursor: 0, attempts: [], flags: [tombstone] });
			expect(repo.flags()).toEqual([]);
		});

		it('adds flags created on another device', () => {
			const repo = new Repository(memoryStore());
			repo.applySync({ sent: [], cursor: 0, attempts: [], flags: [older] });
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
