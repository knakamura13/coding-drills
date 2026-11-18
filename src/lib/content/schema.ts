import { z } from 'zod';

/**
 * Deck content model.
 *
 * Multiple choice keeps the rule that makes this app different from flashcards:
 * every wrong option has exactly one follow-up, and the correct option has
 * none. A tap-cell question explains every wrong cell in place instead, and
 * the correct cell has no miss. A deck that breaks either rule fails the build.
 *
 * Prompts and explanations are Markdown (inline code, bold, italics, fenced
 * code blocks). Option text is inline Markdown.
 */

import { TOPIC_TAGS, type TopicTag } from './tags.ts';

const id = z
	.string()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'use lowercase kebab-case (letters, digits, hyphens)');

const text = (max: number) => z.string().trim().min(1).max(max);

const optionSchema = z
	.object({
		id,
		text: text(90),
		/** Shown from Why? before a follow-up, or inline when this option is the correct answer. */
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

/** Tokens used to compare an explanation with a follow-up option. */
export function contentTokens(value: string): string[] {
	return value
		.toLowerCase()
		.replace(/[`*_#>[\]()]/g, ' ')
		.replace(/[^\p{L}\p{N}\s]/gu, ' ')
		.split(/\s+/)
		.filter((token) => token.length > 0);
}

function containsTokens(haystack: readonly string[], needle: readonly string[]): boolean {
	if (needle.length === 0 || haystack.length < needle.length) return false;
	for (let start = 0; start <= haystack.length - needle.length; start++) {
		let same = true;
		for (let offset = 0; offset < needle.length; offset++) {
			if (haystack[start + offset] !== needle[offset]) {
				same = false;
				break;
			}
		}
		if (same) return true;
	}
	return false;
}

/**
 * True when `optionText` appears inside `explanation`.
 * Options shorter than 6 tokens must appear whole.
 * Longer options fail on any contiguous 6-token slice.
 */
export function repeatsFollowUpAnswer(explanation: string, optionText: string): boolean {
	const haystack = contentTokens(explanation);
	const needle = contentTokens(optionText);
	if (needle.length === 0) return false;
	if (needle.length < 6) return containsTokens(haystack, needle);
	for (let start = 0; start <= needle.length - 6; start++) {
		if (containsTokens(haystack, needle.slice(start, start + 6))) return true;
	}
	return false;
}

const choiceQuestionSchema = z
	.object({
		/** Omitted on every deck written before tap-cell questions existed. */
		format: z.literal('choice').optional(),
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
		const correctOption = question.options.find((option) => option.id === question.correct);
		for (const [optionId, followUp] of Object.entries(question.followUps)) {
			if (!correctOption || optionId === question.correct || !ids.includes(optionId)) continue;
			const picked = question.options.find((option) => option.id === optionId);
			const followUpCorrect = followUp.options.find((option) => option.id === followUp.correct);
			if (!picked || !followUpCorrect) continue;
			if (repeatsFollowUpAnswer(picked.explanation, followUpCorrect.text)) {
				issues.push({
					message: `explanation repeats the follow-up answer "${followUpCorrect.text}"`,
					path: ['options', ids.indexOf(optionId), 'explanation']
				});
			}
			if (repeatsFollowUpAnswer(correctOption.explanation, followUpCorrect.text)) {
				issues.push({
					message: `explanation repeats the follow-up answer for "${optionId}"`,
					path: ['options', ids.indexOf(question.correct), 'explanation']
				});
			}
		}
		for (const issue of issues) ctx.addIssue({ code: 'custom', ...issue });
	});

const cellValue = z
	.union([z.string().max(12), z.number().finite(), z.boolean()])
	.transform((value) => String(value));

const sequenceSchema = z
	.object({
		kind: z.enum(['array', 'string']),
		/** Variable name drawn above the cells, such as `nums` or `code`. */
		name: z
			.string()
			.trim()
			.min(1)
			.max(24)
			.regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
			.optional(),
		cells: z.array(cellValue).min(1).max(12),
		/** A tappable slot at index `cells.length`, for a read one past the end. */
		pastEnd: z.boolean().optional()
	})
	.strict();

const markerSchema = z
	.object({
		name: z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/, 'use a short name such as left, right, or i'),
		at: z.number().int().nonnegative()
	})
	.strict();

const missSchema = z
	.object({
		index: z.number().int().nonnegative(),
		explanation: text(600)
	})
	.strict();

function sequenceLength(sequence: { cells: readonly string[]; pastEnd?: boolean }): number {
	return sequence.cells.length + (sequence.pastEnd ? 1 : 0);
}

/**
 * Tap the index or cell. `misses` is the in-place explanation for every wrong
 * cell, including a past-the-end slot. Markers only label the picture.
 */
const tapCellQuestionSchema = z
	.object({
		format: z.literal('tap-cell'),
		id,
		heading: text(80).optional(),
		/** Markdown. The question, pinned above the code and the sequence. */
		prompt: text(800),
		tags: z.array(z.enum(TOPIC_TAGS)).min(1).max(3).optional(),
		/** Plain text of the snippet. Not Markdown, so indentation is preserved. */
		code: text(800),
		sequence: sequenceSchema,
		/** Named pointers such as `left`, `right`, and `i`. They are not the answer. */
		markers: z.array(markerSchema).max(6).optional(),
		/** Index of the cell that answers the question. */
		correct: z.number().int().nonnegative(),
		/** Shown when that cell is tapped. */
		explanation: text(600),
		/** One entry for every other tappable index. */
		misses: z.array(missSchema).min(1).max(12)
	})
	.strict()
	.superRefine((question, ctx) => {
		const issues: Issue[] = [];
		const count = sequenceLength(question.sequence);
		if (question.correct >= count) {
			issues.push({
				message: `correct index ${question.correct} is outside the sequence`,
				path: ['correct']
			});
		}
		if (question.sequence.kind === 'string') {
			question.sequence.cells.forEach((cell, index) => {
				if ([...cell].length !== 1) {
					issues.push({
						message: 'a string cell must be a single character',
						path: ['sequence', 'cells', index]
					});
				}
			});
		}
		const seen = new Set<number>();
		question.misses.forEach((miss, index) => {
			if (seen.has(miss.index)) {
				issues.push({ message: `duplicate miss for index ${miss.index}`, path: ['misses', index, 'index'] });
			}
			seen.add(miss.index);
			if (miss.index === question.correct) {
				issues.push({
					message: `the correct index ${question.correct} must not have a miss`,
					path: ['misses', index, 'index']
				});
			} else if (miss.index >= count) {
				issues.push({
					message: `miss index ${miss.index} is outside the sequence`,
					path: ['misses', index, 'index']
				});
			}
		});
		for (let index = 0; index < count; index++) {
			if (index !== question.correct && !seen.has(index)) {
				issues.push({
					message: `index ${index} has no explanation (every wrong cell needs one)`,
					path: ['misses']
				});
			}
		}
		const names = new Set<string>();
		for (const [index, marker] of (question.markers ?? []).entries()) {
			if (names.has(marker.name)) {
				issues.push({
					message: `duplicate marker name "${marker.name}"`,
					path: ['markers', index, 'name']
				});
			}
			names.add(marker.name);
			if (marker.at >= count) {
				issues.push({
					message: `marker "${marker.name}" is outside the sequence`,
					path: ['markers', index, 'at']
				});
			}
		}
		for (const issue of issues) ctx.addIssue({ code: 'custom', ...issue });
	});

function questionFormat(value: unknown): unknown {
	if (typeof value === 'object' && value !== null && 'format' in value) {
		return (value as { format: unknown }).format;
	}
	return undefined;
}

function schemaFor(value: unknown) {
	return questionFormat(value) === 'tap-cell' ? tapCellQuestionSchema : choiceQuestionSchema;
}

/**
 * Choice questions stay valid with no `format` field. A `format: tap-cell`
 * question is checked against the tap schema, so a broken choice deck still
 * reports `questions.0.correct` rather than a union of both shapes.
 */
const questionSchema = z
	.any()
	.superRefine((value, ctx) => {
		const result = schemaFor(value).safeParse(value);
		if (!result.success) {
			for (const issue of result.error.issues) {
				ctx.addIssue({ code: 'custom', message: issue.message, path: [...issue.path] });
			}
		}
	})
	.transform((value) => schemaFor(value).parse(value));

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

export type ChoiceQuestion = z.infer<typeof choiceQuestionSchema>;
export type TapCellQuestion = z.infer<typeof tapCellQuestionSchema>;
export type Question = ChoiceQuestion | TapCellQuestion;
export type Deck = z.infer<typeof deckSchema>;
export type QuestionOption = ChoiceQuestion['options'][number];
export type FollowUp = ChoiceQuestion['followUps'][string];
export type FollowUpOption = FollowUp['options'][number];

export function isTapCellQuestion(question: Question): question is TapCellQuestion {
	return question.format === 'tap-cell';
}

export function isChoiceQuestion(question: Question): question is ChoiceQuestion {
	return question.format !== 'tap-cell';
}

/**
 * A deck without its prompts, options, and explanations. Counts, progress, and
 * the menu need only this, so pages that do not play questions never load them.
 */
export interface DeckSummary {
	id: string;
	title: string;
	description: string;
	questions: { id: string; tags?: readonly TopicTag[] }[];
}

export function formatIssues(source: string, issues: readonly z.core.$ZodIssue[]): string {
	return issues
		.map((issue) => {
			const where = issue.path.length > 0 ? issue.path.join('.') : '(root)';
			return `${source}: ${where}: ${issue.message}`;
		})
		.join('\n');
}
