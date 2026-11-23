// Splits a Python snippet into lines of plain and keyword runs for CodeBlock. Keywords are drawn
// bright and SemiBold; everything else stays in Mist. No other syntax colors (lesson Round 2, Code C).

const KEYWORDS = new Set([
	'and', 'as', 'assert', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
	'False', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'None',
	'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'True', 'try', 'while', 'with', 'yield'
]);

export interface CodeRun {
	text: string;
	keyword: boolean;
}

/** One line: its runs, in order. A comment (from `#`) and string literals are never keywords. */
export function codeLines(code: string): CodeRun[][] {
	return code.replace(/\n+$/, '').split('\n').map(splitLine);
}

function splitLine(line: string): CodeRun[] {
	const runs: CodeRun[] = [];
	const push = (text: string, keyword: boolean) => {
		if (!text) return;
		const last = runs.at(-1);
		if (last && last.keyword === keyword && !keyword) last.text += text;
		else runs.push({ text, keyword });
	};
	// Words, string literals, comments, and anything else, in order.
	const token = /([A-Za-z_][A-Za-z0-9_]*)|('(?:\\.|[^'\\])*'?|"(?:\\.|[^"\\])*"?)|(#.*$)|([^A-Za-z_'"#]+)/g;
	for (const match of line.matchAll(token)) {
		const [text, word] = match;
		push(text, word !== undefined && KEYWORDS.has(word));
	}
	return runs;
}
