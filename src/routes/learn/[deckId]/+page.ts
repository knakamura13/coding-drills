import { error } from '@sveltejs/kit';
import { loaders } from 'virtual:deck-loaders';
import { curriculum } from 'virtual:curriculum';
import { branchOfDeck } from '$lib/content/curriculum';
import { isChoiceQuestion, isDragPointersQuestion, isTapCellQuestion, type Question } from '$lib/content/schema';
import type { BranchId } from '$lib/ui/branch';
import type { PageLoad } from './$types';

// The new lesson screen. Option order is random and lesson state lives in the browser, so this
// route renders on the client only, like /play. Until the other formats land on the new screen it
// runs a deck's multiple-choice, tap-the-cell and drag-pointers questions only.
export const ssr = false;
export const prerender = false;

export const load: PageLoad = async ({ params }) => {
	if (!Object.hasOwn(loaders, params.deckId)) error(404, 'Deck not found');
	const { deck } = await loaders[params.deckId]();
	const runs = (question: Question) => isChoiceQuestion(question) || isTapCellQuestion(question) || isDragPointersQuestion(question);
	const shown = { ...deck, questions: deck.questions.filter(runs) };
	if (shown.questions.length === 0) error(404, 'This deck has no questions the new lesson screen runs yet');
	return { deck: shown, branch: branchOfDeck(curriculum, deck.id) as BranchId | null };
};
