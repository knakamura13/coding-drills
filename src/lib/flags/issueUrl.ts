import { REPO_URL } from '$lib/config';
import type { Flag } from '$lib/storage/types';

/** A GitHub "new issue" link prefilled from a flag, so the report reaches the repo. */

export function issueTitle(flag: Flag): string {
	const where = flag.stage === 'followUp' ? `${flag.questionId} (follow-up)` : flag.questionId;
	return `Content flag: ${flag.deckId} / ${where}`;
}

export function issueBody(flag: Flag): string {
	const lines = [
		`- Deck: \`${flag.deckId}\``,
		`- Question: \`${flag.questionId}\``,
		flag.stage === 'followUp'
			? `- Follow-up shown after picking: \`${flag.optionId ?? 'unknown'}\``
			: '- Where: the main question',
		'',
		flag.note.trim() === '' ? '_No note._' : flag.note.trim()
	];
	return lines.join('\n');
}

export function issueUrl(flag: Flag, repoUrl: string = REPO_URL): string {
	const params = new URLSearchParams({
		title: issueTitle(flag),
		body: issueBody(flag),
		labels: 'content'
	});
	return `${repoUrl}/issues/new?${params.toString()}`;
}
