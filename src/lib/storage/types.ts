/**
 * Version 4 expands several one-item checkpoints to full five-item sittings.
 * Version 5 expands the top-K-or-merge checkpoint from two items to a full sitting.
 * Version 6 expands the select-window-method checkpoint from one item to a full sitting.
 * Version 7 expands the validate-or-ancestor checkpoint from two items to a full sitting.
 * Version 8 grows the Greedy choices checkpoint pool.
 * Version 9 grows the Tree summaries checkpoint pool.
 * Version 10 grows the DP storage checkpoint pool.
 * Version 11 grows the Grid tables checkpoint pool.
 * Version 12 grows the Greedy scheduling checkpoint pool.
 * Version 13 grows the Weighted paths checkpoint pool.
 * Version 14 grows the One-dimensional tables checkpoint pool.
 * Version 15 grows the Subsequence tables checkpoint pool.
 * Version 16 grows the Enumerating choices checkpoint pool.
 */
export const EXAM_RULES_VERSION = 16;

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
