import type { CurriculumDrill } from '$lib/content/curriculum';
import type { Deck, DeckSummary } from '$lib/content/schema';
import type { LessonEntry } from '$lib/domain/lesson';
import { cardKey, daysUntilNextDue, dueCards, replay } from '$lib/domain/srs';
import type { Attempt } from '$lib/storage/types';

/** Questions in one review sitting. */
export const REVIEW_SIZE = 10;

/** What the schedule holds today. */
export interface ScheduleCounts {
	/** Questions due today, before the sitting limit. */
	dueCount: number;
	/** Days until the next question is due when none is due now. Null when nothing is scheduled. */
	nextInDays: number | null;
}

export interface ReviewStatus extends ScheduleCounts {
	/** The most overdue questions, up to the sitting limit. */
	entries: LessonEntry[];
}

/** Cards for questions that still exist, and the ones due today, most overdue first. */
function scheduled(decks: readonly DeckSummary[], attempts: readonly Attempt[], today: string) {
	const known = new Set(decks.flatMap((deck) => deck.questions.map((question) => cardKey(deck.id, question.id))));
	const cards = [...replay(attempts).values()].filter((card) => known.has(cardKey(card.deckId, card.questionId)));
	return { cards, due: dueCards(cards, today) };
}

/**
 * The schedule's counts, from deck and question ids alone. The menu, the home
 * screen, and the summary use this, so they never load question text.
 */
export function scheduleCounts(decks: readonly DeckSummary[], attempts: readonly Attempt[], today: string): ScheduleCounts {
	const { cards, due } = scheduled(decks, attempts, today);
	return { dueCount: due.length, nextInDays: due.length > 0 ? 0 : daysUntilNextDue(cards, today) };
}

/**
 * What a review sitting would contain today. Questions whose deck or id no
 * longer exists are skipped: content can be rewritten after attempts were logged.
 */
export function reviewStatus(
	decks: readonly Deck[],
	attempts: readonly Attempt[],
	today: string,
	limit = REVIEW_SIZE,
	/** Card keys to limit the sitting to, such as the drills of one skill. */
	only?: ReadonlySet<string>,
	drills: readonly CurriculumDrill[] = []
): ReviewStatus {
	const questions = new Map<string, LessonEntry>();
	for (const deck of decks) {
		for (const question of deck.questions) {
			questions.set(cardKey(deck.id, question.id), { deckId: deck.id, heading: deck.heading, question });
		}
	}

	const { cards, due: allDue } = scheduled(decks, attempts, today);
	const due = only ? allDue.filter((card) => only.has(cardKey(card.deckId, card.questionId))) : allDue;
	const reserved = new Set(allDue.map((card) => cardKey(card.deckId, card.questionId)));
	const lastSeen = new Map(attempts.map((attempt) => [cardKey(attempt.deckId, attempt.questionId), attempt.day]));
	const skillByQuestion = new Map<string, string>();
	const variantsBySkill = new Map<string, string[]>();
	for (const drill of drills) {
		if (!drill.skillId || (drill.disposition !== 'keep' && drill.disposition !== 'rewrite')) continue;
		const key = cardKey(drill.deckId, drill.questionId);
		skillByQuestion.set(key, drill.skillId);
		if (!drill.variant || !questions.has(key)) continue;
		const variants = variantsBySkill.get(drill.skillId) ?? [];
		variants.push(key);
		variantsBySkill.set(drill.skillId, variants);
	}
	for (const keys of variantsBySkill.values()) {
		keys.sort((a, b) => {
			const observedA = lastSeen.get(a) ?? '';
			const observedB = lastSeen.get(b) ?? '';
			return observedA.localeCompare(observedB) || a.localeCompare(b);
		});
	}

	return {
		dueCount: due.length,
		entries: due.slice(0, limit).map((card) => {
			const key = cardKey(card.deckId, card.questionId);
			const skill = skillByQuestion.get(key);
			const variant = skill && card.correct
				? variantsBySkill.get(skill)?.find((candidate) => !reserved.has(candidate) && (lastSeen.get(candidate) ?? '') < today)
				: undefined;
			if (!variant) return questions.get(key)!;
			reserved.add(variant);
			return { ...questions.get(variant)!, reviewOf: { deckId: card.deckId, questionId: card.questionId } };
		}),
		nextInDays: due.length > 0 ? 0 : daysUntilNextDue(cards, today)
	};
}

export interface DeckProgress {
	/** Questions answered at least once. */
	seen: number;
	/** Questions answered well enough to be scheduled 3 or more days out. */
	learned: number;
	/** Questions due today. */
	due: number;
}

/** How far along each deck is, keyed by deck id. */
export function deckProgress(
	decks: readonly DeckSummary[],
	attempts: readonly Attempt[],
	today: string
): Map<string, DeckProgress> {
	const cards = replay(attempts);
	return new Map(
		decks.map((deck) => {
			const progress: DeckProgress = { seen: 0, learned: 0, due: 0 };
			for (const question of deck.questions) {
				const card = cards.get(`${deck.id}/${question.id}`);
				if (!card) continue;
				progress.seen += 1;
				if (card.interval >= 3) progress.learned += 1;
				if (card.due <= today) progress.due += 1;
			}
			return [deck.id, progress];
		})
	);
}
