import type { CurriculumDrill } from '$lib/content/curriculum';
import { compareAttempts } from '$lib/storage/guards';
import type { Attempt } from '$lib/storage/types';
import { shuffled, type Rng } from './shuffle';
import { cardKey, countedAttempts } from './srs';

/**
 * Sitting a checkpoint.
 *
 * An exam is drawn from the exam drills of the checkpoint's path. Passing is
 * derived from the attempt log, like every other schedule in the app: nothing
 * about a sitting is stored, and every device that holds the same attempts
 * agrees on whether the checkpoint is passed.
 */

/** Items in one sitting, or the whole pool when it is smaller. */
export const EXAM_SIZE = 5;
/** First-try misses a sitting can carry and still pass, when it has more than one item. */
export const EXAM_MAX_MISSES = 1;

export const PASS_RULE = `A sitting is ${EXAM_SIZE} exam items. It passes when at most ${EXAM_MAX_MISSES} is wrong on the first try and every kind of item the checkpoint requires was answered right.`;

/**
 * The items for one sitting. Every kind in `mix` gets at least one item that
 * covers it, so a sitting can never skip a kind the checkpoint requires. The
 * rest is filled from the pool, and the order is shuffled. A sitting is never
 * smaller than `mix` needs, even when that is more than `size`.
 */
export function drawExam<T extends { covers: readonly string[] }>(
	pool: readonly T[],
	mix: readonly string[],
	size: number,
	rng: Rng
): T[] {
	const order = shuffled(pool, rng);
	const chosen: T[] = [];
	const unmet = new Set(mix);
	while (unmet.size > 0) {
		let best: T | null = null;
		let bestCount = 0;
		for (const item of order) {
			if (chosen.includes(item)) continue;
			const count = item.covers.filter((kind) => unmet.has(kind)).length;
			if (count > bestCount) {
				best = item;
				bestCount = count;
			}
		}
		if (!best) break;
		chosen.push(best);
		for (const kind of best.covers) unmet.delete(kind);
	}
	for (const item of order) {
		if (chosen.length >= size) break;
		if (!chosen.includes(item)) chosen.push(item);
	}
	return shuffled(chosen, rng);
}

/**
 * Whether the checkpoint is passed: on some day, the counted first attempts on
 * its exam drills reach a full sitting, with few enough misses, and every kind
 * in `mix` answered right at least once. A drill answered more than once a day
 * counts once, so a retake is a later day.
 */
export function examPassed(drills: readonly CurriculumDrill[], mix: readonly string[], attempts: readonly Attempt[]): boolean {
	const needed = Math.min(EXAM_SIZE, drills.length);
	if (needed === 0) return false;
	const byKey = new Map(drills.map((drill) => [cardKey(drill.deckId, drill.questionId), drill]));
	const allowedMisses = Math.min(EXAM_MAX_MISSES, needed - 1);

	const days = new Map<string, Attempt[]>();
	for (const attempt of countedAttempts([...attempts].sort(compareAttempts))) {
		if (!byKey.has(cardKey(attempt.deckId, attempt.questionId))) continue;
		const sitting = days.get(attempt.day) ?? [];
		sitting.push(attempt);
		days.set(attempt.day, sitting);
	}

	for (const sitting of days.values()) {
		if (sitting.length < needed) continue;
		if (sitting.filter((attempt) => !attempt.correct).length > allowedMisses) continue;
		const covered = new Set(
			sitting.filter((attempt) => attempt.correct).flatMap((attempt) => byKey.get(cardKey(attempt.deckId, attempt.questionId))!.covers)
		);
		if (mix.every((kind) => covered.has(kind))) return true;
	}
	return false;
}
