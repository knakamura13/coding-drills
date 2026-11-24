/**
 * A deliberately tiny Markdown renderer for deck content: paragraphs, numbered
 * steps, fenced code blocks, `inline code`, **bold**, and *italics*. Input is HTML-escaped
 * before any markup is applied, so the output is safe for `{@html}`.
 */

const ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;'
};

export function escapeHtml(text: string): string {
	return text.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

function emphasis(text: string): string {
	return text
		.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
		.replace(/(^|[^\w*])\*(?=\S)([^*\n]*?\S)\*(?![\w*])/g, '$1<em>$2</em>');
}

/** Inline-only rendering, for option labels and headings. */
/** Inline code longer than this may wrap, so one long expression cannot push the page wider than a phone. */
export const LONG_CODE_CHARS = 28;

export function renderInline(source: string): string {
	return escapeHtml(source)
		.split(/(`[^`\n]+`)/g)
		.map((part, index) => {
			if (index % 2 === 0) return emphasis(part);
			const code = part.slice(1, -1);
			return code.length > LONG_CODE_CHARS ? `<code class="long">${code}</code>` : `<code>${code}</code>`;
		})
		.join('');
}

function renderCode(language: string, lines: string[]): string {
	const className = language ? ` class="language-${language}"` : '';
	// A wide block scrolls sideways, so it must be reachable by keyboard.
	return `<pre tabindex="0"><code${className}>${escapeHtml(lines.join('\n'))}</code></pre>`;
}

/**
 * A block of deck Markdown: a paragraph (inline Markdown, unrendered), a numbered list of steps
 * (each step inline Markdown), or a fenced code block.
 */
export type MarkdownBlock =
	| { kind: 'paragraph'; text: string }
	| { kind: 'steps'; steps: string[] }
	| { kind: 'code'; language: string; code: string };

const STEP = /^(\d+)\.\s+(.*)$/;

/**
 * Splits Markdown into blocks. Soft-wrapped lines join with a space, in a paragraph or a step.
 * A line starting `1.`, `2.` and so on starts a step; blank lines between steps keep one list. As in
 * CommonMark, only `1.` can interrupt a paragraph, so a wrapped line that happens to start `2.` cannot.
 */
export function markdownBlocks(source: string): MarkdownBlock[] {
	const blocks: MarkdownBlock[] = [];
	let paragraph: string[] = [];
	let steps: string[][] | null = null;
	let fence: { language: string; lines: string[] } | null = null;

	const flushParagraph = () => {
		if (paragraph.length === 0) return;
		blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
		paragraph = [];
	};
	const flushSteps = () => {
		if (!steps) return;
		blocks.push({ kind: 'steps', steps: steps.map((lines) => lines.join(' ')) });
		steps = null;
	};
	// A blank line ends a paragraph at once, but a list only once something other than a step follows.
	let blank = false;

	for (const line of source.replace(/\r\n/g, '\n').trim().split('\n')) {
		if (fence) {
			if (/^```\s*$/.test(line)) {
				blocks.push({ kind: 'code', language: fence.language, code: fence.lines.join('\n') });
				fence = null;
			} else {
				fence.lines.push(line);
			}
			continue;
		}
		const opening = /^```(\w*)\s*$/.exec(line);
		const step = STEP.exec(line.trim());
		if (opening) {
			flushParagraph();
			flushSteps();
			fence = { language: opening[1], lines: [] };
		} else if (line.trim() === '') {
			flushParagraph();
			blank = true;
			continue;
		} else if (step && (paragraph.length === 0 || step[1] === '1')) {
			flushParagraph();
			(steps ??= []).push([step[2]]);
		} else if (steps && !blank) {
			steps[steps.length - 1].push(line.trim());
		} else {
			flushSteps();
			paragraph.push(line.trim());
		}
		blank = false;
	}
	if (fence) blocks.push({ kind: 'code', language: fence.language, code: fence.lines.join('\n') });
	flushParagraph();
	flushSteps();
	return blocks;
}

/** Block rendering: paragraphs, numbered steps and fenced code. */
export function renderMarkdown(source: string): string {
	return markdownBlocks(source)
		.map((block) => {
			if (block.kind === 'paragraph') return `<p>${renderInline(block.text)}</p>`;
			if (block.kind === 'steps') return `<ol>${block.steps.map((step) => `<li>${renderInline(step)}</li>`).join('')}</ol>`;
			return renderCode(block.language, block.code.split('\n'));
		})
		.join('');
}

/** Markdown reduced to one line of plain text, for lists and summaries. */
export function plainText(markdown: string, max = 120): string {
	const text = markdown
		.replace(/```[\s\S]*?(```|$)/g, ' ')
		.split(/(`[^`\n]+`)/g)
		// Inline code keeps every character it holds, such as the `*` in `a*b`. Elsewhere only
		// emphasis markers that the renderer would act on are removed, so "O(R*C)" stays as written.
		.map((part, index) =>
			index % 2 === 1
				? part.slice(1, -1)
				: part.replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/(^|[^\w*])\*(?=\S)([^*\n]*?\S)\*(?![\w*])/g, '$1$2')
		)
		.join('')
		.replace(/\s+/g, ' ')
		.trim();
	return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
