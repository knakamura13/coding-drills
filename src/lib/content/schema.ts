import { z } from 'zod';

/**
 * Deck content model.
 *
 * The rule that makes this app different from flashcards lives in
 * `questionSchema`: every wrong option must have exactly one follow-up, and
 * the correct option must have none. A deck that breaks the rule fails the
 * build, so a wrong answer can never reach the learner without a follow-up.
 *
 * Prompts and explanations are Markdown (inline code, bold, italics, fenced
 * code blocks). Option text is inline Markdown.
 */

import { TOPIC_TAGS } from './tags.ts';

const id = z
	.string()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'use lowercase kebab-case (letters, digits, hyphens)');

const text = (max: number) => z.string().trim().min(1).max(max);

const optionSchema = z
	.object({
		id,
		text: text(90),
		/** Shown in "See why again". Says why this option is right or wrong here. */
		explanation: text(600)
	})
	.strict();

const followUpOptionSchema = z.object({ id, text: text(140) }).strict();

type Issue = { message: string; path: (string | number)[] };

function duplicates(values: string[]): number[] {
	const seen = new Set<string>();
	const dupes: number[] = [];
	values.forEach((value, index) => {
		if (seen.has(value)) dupes.push(index);
		seen.add(value);
	});
	return dupes;
}

const followUpSchema = z
	.object({
		/** The distinction between the learner's pick and the right answer, as a question. */
		prompt: text(300),
		options: z.array(followUpOptionSchema).min(2).max(4),
		correct: id,
		/** Shown after the follow-up is answered, whether or not it was right. */
		explanation: text(600)
	})
	.strict()
	.superRefine((followUp, ctx) => {
		const issues: Issue[] = [];
		const ids = followUp.options.map((option) => option.id);
		for (const index of duplicates(ids)) {
			issues.push({ message: `duplicate option id "${ids[index]}"`, path: ['options', index, 'id'] });
		}
		const texts = followUp.options.map((option) => option.text.toLowerCase());
		for (const index of duplicates(texts)) {
			issues.push({ message: 'duplicate option text', path: ['options', index, 'text'] });
		}
		if (!ids.includes(followUp.correct)) {
			issues.push({ message: `"${followUp.correct}" is not one of the option ids`, path: ['correct'] });
		}
		for (const issue of issues) ctx.addIssue({ code: 'custom', ...issue });
	});

const questionSchema = z
	.object({
		id,
		/** The instruction above the problem card. Overrides the deck's heading. */
		heading: text(80).optional(),
		/** Markdown. Rendered inside the pinned problem card. */
		prompt: text(800),
		/** Topics, from the fixed list in tags.ts. */
		tags: z.array(z.enum(TOPIC_TAGS)).min(1).max(3).optional(),
		options: z.array(optionSchema).min(2).max(6),
		correct: id,
		/** Keyed by the id of the wrong option that triggers it. */
		followUps: z.record(id, followUpSchema)
	})
	.strict()
	.superRefine((question, ctx) => {
		const issues: Issue[] = [];
		const ids = question.options.map((option) => option.id);
		for (const index of duplicates(ids)) {
			issues.push({ message: `duplicate option id "${ids[index]}"`, path: ['options', index, 'id'] });
		}
		const texts = question.options.map((option) => option.text.toLowerCase());
		for (const index of duplicates(texts)) {
			issues.push({ message: 'duplicate option text', path: ['options', index, 'text'] });
		}
		if (!ids.includes(question.correct)) {
			issues.push({ message: `"${question.correct}" is not one of the option ids`, path: ['correct'] });
		}
		for (const optionId of ids) {
			if (optionId !== question.correct && !(optionId in question.followUps)) {
				issues.push({
					message: `wrong option "${optionId}" has no follow-up (every wrong option needs one)`,
					path: ['followUps']
				});
			}
		}
		for (const key of Object.keys(question.followUps)) {
			if (key === question.correct) {
				issues.push({
					message: `the correct option "${key}" must not have a follow-up`,
					path: ['followUps', key]
				});
			} else if (!ids.includes(key)) {
				issues.push({
					message: `follow-up key "${key}" is not an option id`,
					path: ['followUps', key]
				});
			}
		}
		for (const issue of issues) ctx.addIssue({ code: 'custom', ...issue });
	});

export const deckSchema = z
	.object({
		id,
		title: text(60),
		description: text(200),
		/** Default instruction above each problem card, for example "Which pattern best fits?". */
		heading: text(80).optional(),
		questions: z.array(questionSchema).min(1)
	})
	.strict()
	.superRefine((deck, ctx) => {
		const ids = deck.questions.map((question) => question.id);
		for (const index of duplicates(ids)) {
			ctx.addIssue({
				code: 'custom',
				message: `duplicate question id "${ids[index]}"`,
				path: ['questions', index, 'id']
			});
		}
	});

export type Deck = z.infer<typeof deckSchema>;
export type Question = Deck['questions'][number];
export type QuestionOption = Question['options'][number];
export type FollowUp = Question['followUps'][string];
export type FollowUpOption = FollowUp['options'][number];

export function formatIssues(source: string, issues: readonly z.core.$ZodIssue[]): string {
	return issues
		.map((issue) => {
			const where = issue.path.length > 0 ? issue.path.join('.') : '(root)';
			return `${source}: ${where}: ${issue.message}`;
		})
		.join('\n');
}
