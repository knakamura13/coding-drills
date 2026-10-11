import { describe, expect, it } from 'vitest';
import { escapeHtml, plainText, renderInline, renderMarkdown } from './render';

describe('escapeHtml', () => {
	it('escapes the five HTML-significant characters', () => {
		expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
			'&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;'
		);
	});
});

describe('renderInline', () => {
	it('renders code, bold, and italics', () => {
		expect(renderInline('Use `k` with **care** and *thought*.')).toBe(
			'Use <code>k</code> with <strong>care</strong> and <em>thought</em>.'
		);
	});

	it('escapes HTML in text and inside code spans', () => {
		expect(renderInline('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
		expect(renderInline('`a < b && c`')).toBe('<code>a &lt; b &amp;&amp; c</code>');
	});

	it('leaves emphasis markers inside code alone', () => {
		expect(renderInline('`2 ** 3` and `a * b * c`')).toBe(
			'<code>2 ** 3</code> and <code>a * b * c</code>'
		);
	});

	it('does not treat spaced asterisks as italics', () => {
		expect(renderInline('n * m * k')).toBe('n * m * k');
	});

	it('leaves an unmatched backtick literal', () => {
		expect(renderInline('a ` b')).toBe('a ` b');
	});

	it('keeps formulas with brackets and colons intact', () => {
		expect(renderInline('`nums[i:j + 1]`')).toBe('<code>nums[i:j + 1]</code>');
	});
});

describe('renderMarkdown', () => {
	it('renders paragraphs and joins soft-wrapped lines', () => {
		expect(renderMarkdown('First line\nsecond line\n\nNext paragraph')).toBe(
			'<p>First line second line</p><p>Next paragraph</p>'
		);
	});

	it('renders a fenced code block with its language', () => {
		const source = 'Intro\n\n```python\nx = 1 < 2\n```\n\nOutro';
		expect(renderMarkdown(source)).toBe(
			'<p>Intro</p><pre tabindex="0"><code class="language-python">x = 1 &lt; 2</code></pre><p>Outro</p>'
		);
	});

	it('renders a fence without a language and preserves indentation', () => {
		expect(renderMarkdown('```\nif x:\n    y\n```')).toBe('<pre tabindex="0"><code>if x:\n    y</code></pre>');
	});

	it('closes an unterminated fence at the end of input', () => {
		expect(renderMarkdown('```js\nlet a = 1')).toBe('<pre tabindex="0"><code class="language-js">let a = 1</code></pre>');
	});

	it('does not apply inline markup inside code blocks', () => {
		expect(renderMarkdown('```\n**not bold** `nor code`\n```')).toBe(
			'<pre tabindex="0"><code>**not bold** `nor code`</code></pre>'
		);
	});

	it('handles CRLF input and returns an empty string for blank input', () => {
		expect(renderMarkdown('a\r\n\r\nb')).toBe('<p>a</p><p>b</p>');
		expect(renderMarkdown('  \n ')).toBe('');
	});

	it('escapes HTML in paragraphs', () => {
		expect(renderMarkdown('<img src=x onerror=alert(1)>')).toBe(
			'<p>&lt;img src=x onerror=alert(1)&gt;</p>'
		);
	});
});

describe('plainText', () => {
	it('strips code fences, backticks, and asterisks', () => {
		expect(plainText('Let `n = len(nums)`.\n\n```python\nx = 1\n```')).toBe('Let n = len(nums).');
		expect(plainText('Find the **maximum** sum.')).toBe('Find the maximum sum.');
	});

	it('truncates long text with an ellipsis', () => {
		const result = plainText('word '.repeat(60), 40);
		expect(result.length).toBeLessThanOrEqual(40);
		expect(result.endsWith('…')).toBe(true);
	});

	it('drops an unterminated fence', () => {
		expect(plainText('Intro ```python\nx = 1')).toBe('Intro');
	});
});
