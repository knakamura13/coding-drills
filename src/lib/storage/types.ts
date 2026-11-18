/** Version 2 expanded the Count islands checkpoint to five items. */
export const EXAM_RULES_VERSION = 2;

export interface QuestionRef {
	deckId: string;
	questionId: string;
}

/**
 * One finished question, written when the learner moves past it. Attempts are
 * immutable events: devices exchange them by id and never edit one.
 */
export interface Attempt extends QuestionRef {
	/** Unique across devices. Syncing the same attempt twice stores it once. */
	id: string;
	/** ISO timestamp. */
	at: string;
	/** The learner's calendar day (`YYYY-MM-DD`) when it happened. Stored so every device groups attempts identically. */
	day: string;
	/** The due drill this fresh example reviewed. */
	reviewOf?: QuestionRef;
	/** Exam rules in effect when the attempt was saved. Older attempts omit this. */
	examRulesVersion?: number;
	/**
	 * The option picked on a multiple-choice question, or the cell index for a
	 * tap-cell question (`"0"`, `"1"`, …).
	 */
	pickedId: string;
	correct: boolean;
	/** Present only when a multiple-choice answer was wrong. A wrong tap has none. */
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
