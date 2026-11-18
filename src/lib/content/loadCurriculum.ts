import { readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { parse } from 'yaml';
import { branchSchema, compileCurriculum, type Curriculum } from './curriculum.ts';
import { ContentError, loadDecks } from './loadDecks.ts';
import { isChoiceQuestion } from './schema.ts';

/** Node-only. Reads, parses, and validates the curriculum at build and test time. */

export function curriculumFiles(dir: string): string[] {
	return readdirSync(dir)
		.filter((name) => /\.ya?ml$/.test(name))
		.sort()
		.map((name) => join(dir, name));
}

export function loadCurriculum(curriculumDir: string, decksDir: string): Curriculum {
	const files = curriculumFiles(curriculumDir);
	if (files.length === 0) throw new ContentError(`${curriculumDir}: no curriculum files`);
	const branches = files.map((file) => {
		let raw: unknown;
		try {
			raw = parse(readFileSync(file, 'utf8'));
		} catch (error) {
			throw new ContentError(`${file}: invalid YAML: ${(error as Error).message}`);
		}
		const result = branchSchema.safeParse(raw);
		if (!result.success) {
			const issue = result.error.issues[0];
			const where = issue && issue.path.length > 0 ? issue.path.join('.') : '(root)';
			throw new ContentError(`${file}: ${where}: ${issue?.message ?? 'invalid curriculum file'}`);
		}
		const stem = basename(file, extname(file));
		if (result.data.id !== stem) {
			throw new ContentError(`${file}: branch id "${result.data.id}" must match the file name "${stem}"`);
		}
		return result.data;
	});

	const questions = loadDecks(decksDir).flatMap((deck) =>
		deck.questions.map((question) => ({
			deckId: deck.id,
			questionId: question.id,
			followUpIds: isChoiceQuestion(question) ? Object.keys(question.followUps) : []
		}))
	);
	return compileCurriculum(branches, questions);
}
