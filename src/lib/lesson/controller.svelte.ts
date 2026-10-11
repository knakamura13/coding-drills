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
import type { Rng } from '$lib/domain/shuffle';
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
		/** Changes whenever the learner reaches a new question or follow-up. */
		get stepKey() {
			return `${state.cursor}:${state.stage}`;
		},
		/** Flags created or updated during this run, for the summary. */
		get flags() {
			return sessionFlags;
		},
		/** A human label for what a flag on the current screen would refer to. */
		get flagLabel() {
			const planned = state.plan[state.cursor];
			if (!planned) return '';
			if (state.stage === 'question') return 'The main question';
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
		select(optionId: string) {
			state = select(state, optionId);
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
