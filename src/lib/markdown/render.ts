/**
 * A deliberately tiny Markdown renderer for deck content: paragraphs, fenced
 * code blocks, `inline code`, **bold**, and *italics*. Input is HTML-escaped
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

/** Block rendering: paragraphs and fenced code. Soft-wrapped lines join with a space. */
export function renderMarkdown(source: string): string {
	const output: string[] = [];
	let paragraph: string[] = [];
	let fence: { language: string; lines: string[] } | null = null;

	const flushParagraph = () => {
		if (paragraph.length === 0) return;
		output.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
		paragraph = [];
	};

	for (const line of source.replace(/\r\n/g, '\n').trim().split('\n')) {
		if (fence) {
			if (/^```\s*$/.test(line)) {
				output.push(renderCode(fence.language, fence.lines));
				fence = null;
			} else {
				fence.lines.push(line);
			}
			continue;
		}
		const opening = /^```(\w*)\s*$/.exec(line);
		if (opening) {
			flushParagraph();
			fence = { language: opening[1], lines: [] };
		} else if (line.trim() === '') {
			flushParagraph();
		} else {
			paragraph.push(line.trim());
		}
	}
	if (fence) output.push(renderCode(fence.language, fence.lines));
	flushParagraph();
	return output.join('');
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
