import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrast, model, toCss, toFigcraft, toTs } from './tokens/build';

const root = new URL('../../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const tokens = JSON.parse(read('design/tokens.json'));

describe('generated token files', () => {
	it.each([
		['src/lib/ui/tokens.css', () => toCss(tokens)],
		['src/lib/ui/tokens.ts', () => toTs(tokens)],
		['design/figcraft-variables.json', () => JSON.stringify(toFigcraft(tokens), null, '\t') + '\n']
	])('%s matches design/tokens.json (run `pnpm tokens` after editing it)', (path, build) => {
		expect(read(path)).toBe(build());
	});
});

describe('contrast', () => {
	const m = model(tokens);
	const n = tokens.neutral;
	const surfaces = { page: n.midnight, card: n.night, hover: n.dusk };

	it.each(Object.entries(surfaces))('text roles reach 4.5:1 on the %s surface', (_, surface) => {
		expect(contrast(m.roles['text-primary'].hex, surface)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(m.roles['text-secondary'].hex, surface)).toBeGreaterThanOrEqual(4.5);
	});

	it('muted icons reach 3:1 on every surface', () => {
		for (const surface of Object.values(surfaces)) {
			expect(contrast(m.roles['icon-muted'].hex, surface)).toBeGreaterThanOrEqual(3);
		}
	});

	it('the primary button label reaches 4.5:1', () => {
		expect(contrast(m.roles['action-on-primary'].hex, m.roles['action-primary'].hex)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(m.roles['action-on-primary'].hex, m.roles['action-primary-pressed'].hex)).toBeGreaterThanOrEqual(4.5);
	});

	it.each(Object.entries(m.branches))('%s reads as a signal on the page and keeps text legible on its tint', (_, b) => {
		expect(contrast(b.base, n.midnight)).toBeGreaterThanOrEqual(3);
		expect(contrast(m.roles['text-primary'].hex, b.tint)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(m.roles['text-secondary'].hex, b.tint)).toBeGreaterThanOrEqual(4.5);
	});

	it('the missed status reaches 3:1 on cards', () => {
		expect(contrast(m.roles['status-missed'].hex, n.night)).toBeGreaterThanOrEqual(3);
	});
});
