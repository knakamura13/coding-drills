import { describe, expect, it } from 'vitest';
import { KEYS, MAX_ATTEMPTS, Repository, flagId, type KeyValueStore } from './repository';
import { MAX_NOTE_LENGTH } from './types';

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

const fixedNow = () => new Date('2026-10-10T12:00:00.000Z');

const attempt = (questionId: string, correct = true) => ({
	deckId: 'deck',
	questionId,
	pickedId: 'a',
	correct
});

describe('attempts', () => {
	it('starts empty and records in order with a timestamp', () => {
		const repo = new Repository(memoryStore(), fixedNow);
		expect(repo.attempts()).toEqual([]);
		repo.recordAttempt(attempt('q1'));
		repo.recordAttempt({ ...attempt('q2', false), followUp: { pickedId: 'x', correct: true } });
		expect(repo.attempts()).toEqual([
			{ at: '2026-10-10T12:00:00.000Z', deckId: 'deck', questionId: 'q1', pickedId: 'a', correct: true },
			{
				at: '2026-10-10T12:00:00.000Z',
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

	it('drops the oldest attempts beyond the cap', () => {
		const repo = new Repository(memoryStore(), fixedNow);
		for (let i = 0; i < MAX_ATTEMPTS + 5; i++) repo.recordAttempt(attempt(`q${i}`));
		const attempts = repo.attempts();
		expect(attempts).toHaveLength(MAX_ATTEMPTS);
		expect(attempts[0].questionId).toBe('q5');
	});

	it('ignores corrupted JSON and malformed entries', () => {
		const good = { at: 't', deckId: 'd', questionId: 'q', pickedId: 'a', correct: true };
		const badFollowUp = { ...good, followUp: { pickedId: 1 } };
		const missing = { at: 't' };
		expect(new Repository(memoryStore({ [KEYS.attempts]: '{not json' })).attempts()).toEqual([]);
		expect(new Repository(memoryStore({ [KEYS.attempts]: '{"a":1}' })).attempts()).toEqual([]);
		expect(new Repository(memoryStore({ [KEYS.attempts]: '"text"' })).attempts()).toEqual([]);
		expect(
			new Repository(
				memoryStore({ [KEYS.attempts]: JSON.stringify([good, badFollowUp, missing, null, 7]) })
			).attempts()
		).toEqual([good]);
	});
});

describe('flags', () => {
	const base = { deckId: 'deck', questionId: 'q1', stage: 'question' as const, note: '  Wrong claim.  ' };

	it('creates a flag with a deterministic id and a trimmed note', () => {
		const repo = new Repository(memoryStore(), fixedNow);
		const flag = repo.upsertFlag(base);
		expect(flag).toEqual({
			id: 'deck/q1/question',
			at: '2026-10-10T12:00:00.000Z',
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

	it('removes a flag by id', () => {
		const repo = new Repository(memoryStore(), fixedNow);
		const flag = repo.upsertFlag(base);
		repo.removeFlag(flag.id);
		expect(repo.flags()).toEqual([]);
	});

	it('drops malformed stored flags', () => {
		const good = { id: 'i', at: 't', deckId: 'd', questionId: 'q', stage: 'question', note: '' };
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
