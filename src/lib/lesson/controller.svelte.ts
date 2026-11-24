import { isChoiceQuestion, isDragPointersQuestion, isStepTraceQuestion, isTapCellQuestion } from '$lib/content/schema';
import {
	advance,
	check,
	isFinished,
	isPristine,
	progress,
	select,
	summarize,
	view,
	type LessonState
} from '$lib/domain/lesson';
import { movePointer } from '$lib/domain/drag';
import type { Rng } from '$lib/domain/shuffle';
import { preferences } from '$lib/preferences/store.svelte';
import { getRepository, type Flag } from '$lib/storage';
import { syncSoon } from '$lib/sync/store.svelte';

/** Where a lesson's questions come from: one deck, or today's review across decks. */
export interface LessonSource {
	create(rng: Rng): LessonState;
}

/**
 * Wraps the pure lesson state machine in Svelte state and writes the side
 * effects the machine does not own: attempts and flags go to browser storage,
 * and a signed-in device then syncs them.
 */
export function createLessonController(source: LessonSource, rng: Rng = Math.random) {
	let state = $state.raw<LessonState>(source.create(rng));
	let sessionFlags = $state.raw<Flag[]>([]);

	const screen = $derived(view(state));
	const finished = $derived(isFinished(state));
	const summary = $derived(isFinished(state) ? summarize(state) : null);

	function flagTarget() {
		const planned = state.plan[state.cursor];
		if (!planned) return null;
		const optionId = state.stage === 'followUp' ? (state.mainPick ?? undefined) : undefined;
		return { deckId: planned.deckId, questionId: planned.question.id, stage: state.stage, optionId };
	}

	return {
		get screen() {
			return screen;
		},
		get finished() {
			return finished;
		},
		get summary() {
			return summary;
		},
		get pristine() {
			return isPristine(state);
		},
		get progress() {
			return progress(state);
		},
		get selectedId() {
			return state.selected;
		},
		/** Changes whenever the learner reaches a new question or follow-up, or a trace's next step. */
		get stepKey() {
			return `${state.cursor}:${state.stage}:${state.picks.length}`;
		},
		/** Like `stepKey`, but a trace's steps share it: they stack on one screen. */
		get questionKey() {
			return `${state.cursor}:${state.stage}`;
		},
		/** Flags created or updated during this run, for the summary. */
		get flags() {
			return sessionFlags;
		},
		/** A human label for what a flag on the current screen would refer to. */
		get flagLabel() {
			const planned = state.plan[state.cursor];
			if (!planned || state.stage === 'question' || !isChoiceQuestion(planned.question)) return 'The main question';
			const picked = planned.question.options.find((option) => option.id === state.mainPick);
			return `The follow-up shown after picking "${picked?.text ?? 'an option'}"`;
		},
		/** The saved note when the current screen was flagged before. */
		get flagNote() {
			const target = flagTarget();
			if (!target) return '';
			const existing = getRepository()
				.flags()
				.find(
					(flag) =>
						flag.deckId === target.deckId &&
						flag.questionId === target.questionId &&
						flag.stage === target.stage &&
						flag.optionId === target.optionId
				);
			return existing?.note ?? '';
		},
		/** `atOnce` lets a screen decide whether this pick is also the answer; otherwise the old UI's rule applies. */
		select(optionId: string, atOnce?: boolean) {
			const question = state.plan[state.cursor]?.question;
			// A tap, and each step of a trace, answers in one gesture. Multiple choice follows
			// the preference. A drag answer has several pointers to place, so it waits for Check.
			const immediate =
				atOnce ??
				(question
					? isTapCellQuestion(question) ||
						isStepTraceQuestion(question) ||
						(preferences.immediateFeedback && isChoiceQuestion(question))
					: false);
			state = select(state, optionId, immediate);
		},
		/** Moves one pointer of a drag question. The answer is every pointer's cell, checked on Check. */
		place(name: string, at: number) {
			const question = state.plan[state.cursor]?.question;
			if (!question || !isDragPointersQuestion(question)) return;
			const pick = movePointer(question, state.selected, name, at);
			if (pick !== null) state = select(state, pick);
		},
		check() {
			state = check(state);
		},
		advance() {
			const before = state.completed.length;
			state = advance(state);
			if (state.completed.length > before) {
				getRepository().recordAttempt(state.completed[state.completed.length - 1]);
				syncSoon();
			}
		},
		restart() {
			state = source.create(rng);
			sessionFlags = [];
		},
		flag(note: string): Flag | null {
			const target = flagTarget();
			if (!target) return null;
			const saved = getRepository().upsertFlag({
				deckId: target.deckId,
				questionId: target.questionId,
				stage: target.stage,
				optionId: target.optionId,
				note
			});
			sessionFlags = [...sessionFlags.filter((flag) => flag.id !== saved.id), saved];
			syncSoon();
			return saved;
		}
	};
}

export type LessonController = ReturnType<typeof createLessonController>;
