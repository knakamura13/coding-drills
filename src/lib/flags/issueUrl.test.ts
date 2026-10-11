import { describe, expect, it } from 'vitest';
import type { Flag } from '$lib/storage/types';
import { issueBody, issueTitle, issueUrl } from './issueUrl';

const flag: Flag = {
	id: 'deck/q1/question',
	at: '2026-10-10T12:00:00.000Z',
	deckId: 'pattern-identification',
	questionId: 'window-max-sum-k',
	stage: 'question',
	note: 'Explanation says O(n) but the code is O(n log n).'
};

const followUpFlag: Flag = { ...flag, stage: 'followUp', optionId: 'two-pointers', note: '' };

describe('issueUrl', () => {
	it('points at the repository new-issue form with the content label', () => {
		const url = new URL(issueUrl(flag));
		expect(url.origin + url.pathname).toBe('https://github.com/knakamura13/coding-drills/issues/new');
		expect(url.searchParams.get('labels')).toBe('content');
	});

	it('round-trips the title and body through the query string', () => {
		const url = new URL(issueUrl(flag));
		expect(url.searchParams.get('title')).toBe(issueTitle(flag));
		expect(url.searchParams.get('body')).toBe(issueBody(flag));
	});

	it('uses the repo URL it is given', () => {
		expect(issueUrl(flag, 'https://example.test/o/r').startsWith('https://example.test/o/r/issues/new?')).toBe(
			true
		);
	});
});

describe('issue text', () => {
	it('names the deck, question, and note for a main-question flag', () => {
		expect(issueTitle(flag)).toBe('Content flag: pattern-identification / window-max-sum-k');
		expect(issueBody(flag)).toBe(
			[
				'- Deck: `pattern-identification`',
				'- Question: `window-max-sum-k`',
				'- Where: the main question',
				'',
				'Explanation says O(n) but the code is O(n log n).'
			].join('\n')
		);
	});

	it('names the picked option for a follow-up flag and marks an empty note', () => {
		expect(issueTitle(followUpFlag)).toBe(
			'Content flag: pattern-identification / window-max-sum-k (follow-up)'
		);
		const body = issueBody(followUpFlag);
		expect(body).toContain('- Follow-up shown after picking: `two-pointers`');
		expect(body.endsWith('_No note._')).toBe(true);
	});

	it('falls back when a follow-up flag has no option id', () => {
		expect(issueBody({ ...followUpFlag, optionId: undefined })).toContain('`unknown`');
	});
});
