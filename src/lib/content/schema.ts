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

/**
 * Markdown. A short solved example the learner can open from the question. Kept apart from the
 * prompt so the prompt is only the question. Optional: not every question has one.
 */
const workedExample = text(800).optional();

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
		workedExample,
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

const markerName = z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/, 'use a short name such as left, right, or i');

const markerSchema = z
	.object({
		name: markerName,
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

/** A string sequence is drawn one character per cell. */
function stringCellIssues(sequence: { kind: 'array' | 'string'; cells: readonly string[] }): Issue[] {
	if (sequence.kind !== 'string') return [];
	return sequence.cells.flatMap((cell, index) =>
		[...cell].length === 1 ? [] : [{ message: 'a string cell must be a single character', path: ['sequence', 'cells', index] }]
	);
}

/** Marker names must be unique, and every marker must sit inside the sequence. */
function markerIssues(markers: readonly { name: string; at: number }[], count: number, path: string): Issue[] {
	const issues: Issue[] = [];
	const names = new Set<string>();
	markers.forEach((marker, index) => {
		if (names.has(marker.name)) {
			issues.push({ message: `duplicate marker name "${marker.name}"`, path: [path, index, 'name'] });
		}
		names.add(marker.name);
		if (marker.at >= count) {
			issues.push({ message: `marker "${marker.name}" is outside the sequence`, path: [path, index, 'at'] });
		}
	});
	return issues;
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
		workedExample,
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
		issues.push(...stringCellIssues(question.sequence));
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
		issues.push(...markerIssues(question.markers ?? [], count, 'markers'));
		for (const issue of issues) ctx.addIssue({ code: 'custom', ...issue });
	});

const pointerSchema = z
	.object({
		name: markerName,
		/** Where the pointer sits before the learner moves it. */
		start: z.number().int().nonnegative(),
		/** The cell it belongs on. */
		correct: z.number().int().nonnegative(),
		/** Shown once the pointer is on the right cell. */
		explanation: text(600),
		/** Targeted explanations for the plausible wrong cells. */
		misses: z.array(missSchema).max(11).optional(),
		/** Shown for any wrong cell that has no entry in `misses`. */
		elsewhere: text(600)
	})
	.strict();

/**
 * Drag the pointers. The learner moves each named pointer to the cell it
 * reaches after the step the prompt describes, by dragging it or by tapping it
 * and then a cell. Each wrong pointer explains itself in place: `misses` for
 * the likely mistakes, `elsewhere` for the rest.
 */
const dragPointersQuestionSchema = z
	.object({
		format: z.literal('drag-pointers'),
		id,
		heading: text(80).optional(),
		workedExample,
		prompt: text(800),
		tags: z.array(z.enum(TOPIC_TAGS)).min(1).max(3).optional(),
		/** Plain text of the snippet. Not Markdown, so indentation is preserved. */
		code: text(800),
		/** At most 8 cells, so a pointer can travel the whole row on a phone. */
		sequence: sequenceSchema,
		/** Pointers that stay where they are, as context for the question. */
		markers: z.array(markerSchema).max(4).optional(),
		pointers: z.array(pointerSchema).min(1).max(3)
	})
	.strict()
	.superRefine((question, ctx) => {
		const issues: Issue[] = [];
		const count = sequenceLength(question.sequence);
		if (question.sequence.cells.length > 8) {
			issues.push({ message: 'a drag question draws at most 8 cells', path: ['sequence', 'cells'] });
		}
		issues.push(...stringCellIssues(question.sequence));
		const named = [
			...(question.markers ?? []).map((marker) => ({ name: marker.name, at: marker.at })),
			...question.pointers.map((pointer) => ({ name: pointer.name, at: pointer.start }))
		];
		const duplicated = named.filter((item, index) => named.findIndex((other) => other.name === item.name) !== index);
		for (const item of duplicated) {
			issues.push({ message: `duplicate pointer or marker name "${item.name}"`, path: ['pointers'] });
		}
		issues.push(...markerIssues(question.markers ?? [], count, 'markers'));
		question.pointers.forEach((pointer, position) => {
			const at = (...rest: (string | number)[]) => ['pointers', position, ...rest];
			if (pointer.start >= count) {
				issues.push({ message: `"${pointer.name}" starts outside the sequence`, path: at('start') });
			}
			if (pointer.correct >= count) {
				issues.push({ message: `"${pointer.name}" belongs outside the sequence`, path: at('correct') });
			}
			const seen = new Set<number>();
			(pointer.misses ?? []).forEach((miss, index) => {
				if (seen.has(miss.index)) {
					issues.push({ message: `duplicate miss for index ${miss.index}`, path: at('misses', index) });
				}
				seen.add(miss.index);
				if (miss.index === pointer.correct) {
					issues.push({ message: `the correct index ${miss.index} must not have a miss`, path: at('misses', index) });
				} else if (miss.index >= count) {
					issues.push({ message: `miss index ${miss.index} is outside the sequence`, path: at('misses', index) });
				}
			});
		});
		if (!question.pointers.some((pointer) => pointer.start !== pointer.correct)) {
			issues.push({ message: 'at least one pointer must have to move', path: ['pointers'] });
		}
		for (const issue of issues) ctx.addIssue({ code: 'custom', ...issue });
	});

const traceCellStepSchema = z
	.object({
		/** 1-based line of `code` that runs in this step. It is highlighted while the step is open. */
		line: z.number().int().positive().optional(),
		/** What the learner predicts, for example "Where does `l` sit after this pass?". */
		ask: text(160),
		/** The pointer the learner places by tapping a cell. */
		pointer: markerName,
		correct: z.number().int().nonnegative(),
		explanation: text(600),
		misses: z.array(missSchema).max(11).optional(),
		elsewhere: text(600),
		/** Other pointers that move in the same step. They are shown once the step is revealed. */
		also: z.array(markerSchema).max(3).optional()
	})
	.strict();

const traceChoiceStepSchema = z
	.object({
		line: z.number().int().positive().optional(),
		/** A value the learner predicts by choosing from a few options, for example the next `total`. */
		ask: text(160),
		options: z.array(optionSchema).min(2).max(4),
		correct: id,
		also: z.array(markerSchema).max(3).optional()
	})
	.strict();

/** A step with a `pointer` is a cell step. Picking the schema by that key keeps an error on the field that is wrong. */
function traceStepSchemaFor(value: unknown) {
	return typeof value === 'object' && value !== null && 'pointer' in value ? traceCellStepSchema : traceChoiceStepSchema;
}

const traceStepSchema = z
	.any()
	.superRefine((value, ctx) => {
		const result = traceStepSchemaFor(value).safeParse(value);
		if (!result.success) {
			for (const issue of result.error.issues) {
				ctx.addIssue({ code: 'custom', message: issue.message, path: [...issue.path] });
			}
		}
	})
	.transform((value) => traceStepSchemaFor(value).parse(value));

/**
 * Step-through trace. The learner steps through code and predicts what each
 * step does before it is revealed: a pointer's cell (tap it) or a value (pick
 * it). Every wrong prediction explains itself in place and the true state is
 * then shown, so the trace carries on from the truth. The question is right
 * only when every prediction was.
 */
const stepTraceQuestionSchema = z
	.object({
		format: z.literal('step-trace'),
		id,
		heading: text(80).optional(),
		workedExample,
		prompt: text(800),
		tags: z.array(z.enum(TOPIC_TAGS)).min(1).max(3).optional(),
		/** Plain text of the snippet. Lines are numbered from 1. */
		code: text(800),
		sequence: sequenceSchema,
		/** Where every pointer sits before the first step. */
		start: z.array(markerSchema).min(1).max(4),
		steps: z.array(traceStepSchema).min(2).max(5)
	})
	.strict()
	.superRefine((question, ctx) => {
		const issues: Issue[] = [];
		const count = sequenceLength(question.sequence);
		const lines = question.code.split('\n').length;
		issues.push(...stringCellIssues(question.sequence));
		if (question.sequence.cells.length > 8) {
			issues.push({ message: 'a trace draws at most 8 cells', path: ['sequence', 'cells'] });
		}
		issues.push(...markerIssues(question.start, count, 'start'));
		const names = new Set(question.start.map((marker) => marker.name));
		question.steps.forEach((step, position) => {
			const at = (...rest: (string | number)[]) => ['steps', position, ...rest];
			if (step.line !== undefined && step.line > lines) {
				issues.push({ message: `line ${step.line} is past the end of the code (${lines} lines)`, path: at('line') });
			}
			for (const [index, other] of (step.also ?? []).entries()) {
				if (!names.has(other.name)) {
					issues.push({ message: `"${other.name}" is not a pointer in start`, path: at('also', index, 'name') });
				}
				if (other.at >= count) {
					issues.push({ message: `"${other.name}" moves outside the sequence`, path: at('also', index, 'at') });
				}
			}
			if ('pointer' in step) {
				if (!names.has(step.pointer)) {
					issues.push({ message: `"${step.pointer}" is not a pointer in start`, path: at('pointer') });
				}
				if (step.correct >= count) {
					issues.push({ message: `correct index ${step.correct} is outside the sequence`, path: at('correct') });
				}
				const seen = new Set<number>();
				(step.misses ?? []).forEach((miss, index) => {
					if (seen.has(miss.index)) {
						issues.push({ message: `duplicate miss for index ${miss.index}`, path: at('misses', index) });
					}
					seen.add(miss.index);
					if (miss.index === step.correct) {
						issues.push({ message: `the correct index ${miss.index} must not have a miss`, path: at('misses', index) });
					} else if (miss.index >= count) {
						issues.push({ message: `miss index ${miss.index} is outside the sequence`, path: at('misses', index) });
					}
				});
			} else {
				const ids = step.options.map((option) => option.id);
				for (const index of duplicates(ids)) {
					issues.push({ message: `duplicate option id "${ids[index]}"`, path: at('options', index, 'id') });
				}
				const texts = step.options.map((option) => option.text.toLowerCase());
				for (const index of duplicates(texts)) {
					issues.push({ message: 'duplicate option text', path: at('options', index, 'text') });
				}
				if (!ids.includes(step.correct)) {
					issues.push({ message: `"${step.correct}" is not one of the option ids`, path: at('correct') });
				}
			}
		});
		for (const issue of issues) ctx.addIssue({ code: 'custom', ...issue });
	});

function questionFormat(value: unknown): unknown {
	if (typeof value === 'object' && value !== null && 'format' in value) {
		return (value as { format: unknown }).format;
	}
	return undefined;
}

function schemaFor(value: unknown) {
	const format = questionFormat(value);
	if (format === 'tap-cell') return tapCellQuestionSchema;
	if (format === 'drag-pointers') return dragPointersQuestionSchema;
	if (format === 'step-trace') return stepTraceQuestionSchema;
	return choiceQuestionSchema;
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
export type DragPointersQuestion = z.infer<typeof dragPointersQuestionSchema>;
export type StepTraceQuestion = z.infer<typeof stepTraceQuestionSchema>;
export type TraceStep = StepTraceQuestion['steps'][number];
export type TraceCellStep = z.infer<typeof traceCellStepSchema>;
export type TraceChoiceStep = z.infer<typeof traceChoiceStepSchema>;
export type Question = ChoiceQuestion | TapCellQuestion | DragPointersQuestion | StepTraceQuestion;
export type Deck = z.infer<typeof deckSchema>;
export type QuestionOption = ChoiceQuestion['options'][number];
export type FollowUp = ChoiceQuestion['followUps'][string];
export type FollowUpOption = FollowUp['options'][number];

export function isTapCellQuestion(question: Question): question is TapCellQuestion {
	return question.format === 'tap-cell';
}

export function isDragPointersQuestion(question: Question): question is DragPointersQuestion {
	return question.format === 'drag-pointers';
}

export function isStepTraceQuestion(question: Question): question is StepTraceQuestion {
	return question.format === 'step-trace';
}

/** A trace step the learner answers by tapping a cell, as opposed to choosing a value. */
export function isCellStep(step: TraceStep): step is TraceCellStep {
	return 'pointer' in step;
}

export function isChoiceQuestion(question: Question): question is ChoiceQuestion {
	return question.format === undefined || question.format === 'choice';
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
