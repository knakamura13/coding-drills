/**
 * One finished question, written when the learner moves past it. Attempts are
 * immutable events: devices exchange them by id and never edit one.
 */
export interface Attempt {
	/** Unique across devices. Syncing the same attempt twice stores it once. */
	id: string;
	/** ISO timestamp. */
	at: string;
	/** The learner's calendar day (`YYYY-MM-DD`) when it happened. Stored so every device groups attempts identically. */
	day: string;
	deckId: string;
	questionId: string;
	/** The option picked on the main question. */
	pickedId: string;
	correct: boolean;
	/** Present only when the main answer was wrong. */
	followUp?: { pickedId: string; correct: boolean };
}

export type FlagStage = 'question' | 'followUp';

/** A question the learner marked as wrong or confusing. */
export interface Flag {
	/** Deterministic per target, so flagging the same thing again updates the note. */
	id: string;
	/** ISO timestamp of the latest update. The newest copy wins when devices disagree. */
	at: string;
	deckId: string;
	questionId: string;
	stage: FlagStage;
	/** For a follow-up flag: the wrong option whose follow-up this is. */
	optionId?: string;
	note: string;
	/** A tombstone: the flag was deleted. Kept so the deletion reaches other devices. */
	removed?: true;
}

export const MAX_NOTE_LENGTH = 1000;
