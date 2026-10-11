/** One finished question, written when the learner moves past it. */
export interface Attempt {
	/** ISO timestamp. */
	at: string;
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
	/** ISO timestamp of the latest update. */
	at: string;
	deckId: string;
	questionId: string;
	stage: FlagStage;
	/** For a follow-up flag: the wrong option whose follow-up this is. */
	optionId?: string;
	note: string;
}

export const MAX_NOTE_LENGTH = 1000;
