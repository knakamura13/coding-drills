import { decks as allDecks } from 'virtual:deck-index';
import { DEFAULT_LEVEL } from '$lib/content/depth';
import type { DeckSummary } from '$lib/content/schema';
import { localDay } from '$lib/domain/days';
import { streak } from '$lib/domain/streak';
import { suggestedDeck } from '$lib/review/decks';
import { decksAtLearnerLevel } from '$lib/review/level';
import { deckProgress, scheduleCounts, type DeckProgress, type ScheduleCounts } from '$lib/review/queue';
import { weakCount } from '$lib/review/weak';
import { getRepository } from '$lib/storage';

/**
 * The counts and suggestions the top bar, the menu, and the home screen show,
 * all derived from the local attempt log. It is read again after every page
 * change and whenever a sync brings new data, so a count is never older than
 * the page the learner is on. It reads the deck index only, never question
 * text. Counts cover the questions at the learner's depth level only (#155),
 * except the streak, which counts every answer. Browser only: call
 * `refreshStatus` from mounted code.
 */
export interface NavStatus {
	/** False until the first read, so the first paint shows nothing that depends on it. */
	ready: boolean;
	/** The decks at the learner's level, with only their visible questions. The default level's until the first read, so prerendered pages match. */
	decks: DeckSummary[];
	flags: number;
	/** Null when nothing is due and nothing is scheduled. */
	review: ScheduleCounts | null;
	/** Questions failed at least once. */
	weak: number;
	streak: number;
	progress: Map<string, DeckProgress>;
	/** The deck the home screen offers to start next. */
	suggested: DeckSummary | null;
}

const EMPTY: NavStatus = {
	ready: false,
	decks: decksAtLearnerLevel(allDecks, DEFAULT_LEVEL),
	flags: 0,
	review: null,
	weak: 0,
	streak: 0,
	progress: new Map(),
	suggested: null
};

let current = $state.raw<NavStatus>(EMPTY);

export const status = {
	get snapshot(): NavStatus {
		return current;
	}
};

export function refreshStatus(): void {
	const repository = getRepository();
	const attempts = repository.attempts();
	const today = localDay(new Date());
	// The level is read again on every refresh, so a change made in another tab shows on the next page.
	const decks = decksAtLearnerLevel(allDecks);
	const progress = deckProgress(decks, attempts, today);
	const schedule = scheduleCounts(decks, attempts, today);
	// Attempts are sorted oldest first, so the last one is the most recent answer.
	const lastStudied = attempts.length > 0 ? attempts[attempts.length - 1].deckId : null;
	current = {
		ready: true,
		decks,
		flags: repository.flags().length,
		review: schedule.dueCount > 0 || schedule.nextInDays !== null ? schedule : null,
		weak: weakCount(decks, attempts),
		streak: streak(
			attempts.map((attempt) => attempt.day),
			today
		),
		progress,
		suggested: suggestedDeck(decks, progress, lastStudied)
	};
}
