// Turns design/tokens.json into the three generated files: src/lib/ui/tokens.css,
// src/lib/ui/tokens.ts and design/figcraft-variables.json. Pure functions, so tokens.test.ts can
// check the files on disk are current. `pnpm tokens` (scripts/build-tokens.mjs) writes them.

/** design/tokens.json as parsed JSON. Its shape is documented by the file itself. */
export type TokenFile = any;
type Accent = { base: string; tint: string; border: string; ambient: string; glow: string; softGlow: string };

const HEADER = 'Generated from design/tokens.json by `pnpm tokens`. Do not edit by hand.';

function rgb(hex: string): number[] {
	const n = parseInt(hex.slice(1), 16);
	return [n >> 16, (n >> 8) & 255, n & 255];
}

function toHex(c: number[]): string {
	return '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0').toUpperCase()).join('');
}

/** `amount` of `top` blended over `base`, per sRGB channel. */
export function mix(base: string, top: string, amount: number): string {
	const a = rgb(base);
	const b = rgb(top);
	return toHex(a.map((v, i) => v * (1 - amount) + b[i] * amount));
}

export function rgba(hex: string, alpha: number): string {
	const [r, g, b] = rgb(hex);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** WCAG contrast ratio of two hex colors. */
export function contrast(a: string, b: string): number {
	const lum = (hex: string) => {
		const [r, g, bl] = rgb(hex).map((v) => {
			const c = v / 255;
			return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
	};
	const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

/** Resolved values every output shares. */
export function model(t: TokenFile) {
	const n = t.neutral;
	const color = (name: string): string => n[name] ?? t.hue[name] ?? name;
	const accentFor = (hex: string): Accent => ({
		base: hex,
		tint: mix(n[t.accent.tint.over], hex, t.accent.tint.amount),
		border: mix(n[t.accent.border.over], hex, t.accent.border.amount),
		ambient: mix(n[t.accent.ambient.over], hex, t.accent.ambient.amount),
		glow: rgba(hex, t.accent['glow-alpha']),
		softGlow: rgba(hex, t.accent['soft-glow-alpha'])
	});
	const branches = Object.fromEntries(
		Object.entries(t.branch as Record<string, string>).map(([id, hue]) => [id, { hue, ...accentFor(t.hue[hue]) }])
	) as Record<string, Accent & { hue: string }>;
	const wb = t.feedback['wrong-border'];
	return {
		neutral: n as Record<string, string>,
		hue: t.hue as Record<string, string>,
		neutralNames: n as Record<string, string>,
		roles: Object.fromEntries(Object.entries(t.role as Record<string, string>).map(([k, v]) => [k, { ref: v, hex: color(v) }])) as Record<string, { ref: string; hex: string }>,
		none: accentFor(color(t.accent.none)),
		branches,
		wrongBorder: mix(n[wb.over], t.hue[wb.hue], wb.amount),
		scrim: rgba(color(t.overlay.scrim.color), t.overlay.scrim.alpha),
		cardEdge: rgba(t.overlay['card-edge'].color, t.overlay['card-edge'].alpha)
	};
}

const px = (v: number) => `${v}px`;
const em = (v: number) => (v === 0 ? '0' : `${v}em`);
const visible = (o: Record<string, TokenFile>): [string, TokenFile][] => Object.entries(o).filter(([k]) => !k.startsWith('$'));

export function toCss(t: TokenFile): string {
	const m = model(t);
	const lines: string[] = [`/* ${HEADER} */`, '', ':root {'];
	const push = (name: string, value: string) => lines.push(`\t--${name}: ${value};`);
	lines.push('\t/* neutrals and hues */');
	for (const [k, v] of Object.entries(m.neutral)) push(`neutral-${k}`, v);
	for (const [k, v] of Object.entries(m.hue)) push(`hue-${k}`, v);
	lines.push('\t/* roles: screens use these, never the raw values above */');
	for (const [k, v] of Object.entries(m.roles)) {
		push(`color-${k}`, `var(--${m.neutral[v.ref] ? 'neutral' : 'hue'}-${v.ref})`);
	}
	push('color-feedback-wrong-border', m.wrongBorder);
	push('color-scrim', m.scrim);
	push('color-card-edge', m.cardEdge);
	lines.push('\t/* each branch, for screens that show several (the whole tree) */');
	for (const [id, b] of Object.entries(m.branches)) {
		push(`branch-${id}`, `var(--hue-${b.hue})`);
		push(`branch-${id}-tint`, b.tint);
		push(`branch-${id}-border`, b.border);
		push(`branch-${id}-ambient`, b.ambient);
		push(`branch-${id}-glow`, b.glow);
		push(`branch-${id}-soft-glow`, b.softGlow);
	}
	lines.push('\t/* the current screen\'s branch: set data-branch on a container; none by default */');
	const accent = (a: Accent, base: string) => {
		push('accent', base);
		push('accent-tint', a.tint);
		push('accent-border', a.border);
		push('accent-ambient', a.ambient);
		push('accent-glow', a.glow);
		push('accent-soft-glow', a.softGlow);
	};
	accent(m.none, `var(--neutral-${t.accent.none})`);
	lines.push('\t/* type */');
	push('font-sans', t.font.sans);
	push('font-mono', t.font.mono);
	for (const [k, v] of visible(t.text)) {
		push(`text-${k}-size`, px(v.size));
		push(`text-${k}-line`, px(v.line));
		push(`text-${k}-weight`, String(v.weight));
		push(`text-${k}-tracking`, em(v.tracking));
	}
	lines.push('\t/* space and radius */');
	for (const [k, v] of Object.entries(t.space as Record<string, number>)) push(`space-${k}`, px(v));
	for (const [k, v] of Object.entries(t.radius as Record<string, number>)) push(`radius-${k}`, px(v));
	lines.push('\t/* motion: Reduce effects sets --shift and --fx to 0 below */');
	push('ease', t.motion.ease);
	for (const [k, v] of Object.entries(t.motion.duration as Record<string, number>)) push(`dur-${k}`, `${v}ms`);
	push('shift', String(t.motion.shift.full));
	push('fx', String(t.motion.fx.full));
	push('toast-distance', px(t.motion['toast-distance']));
	lines.push('}', '');

	for (const [id] of Object.entries(m.branches)) {
		lines.push(`[data-branch='${id}'] {`);
		push('accent', `var(--branch-${id})`);
		for (const part of ['tint', 'border', 'ambient', 'glow', 'soft-glow']) push(`accent-${part}`, `var(--branch-${id}-${part})`);
		lines.push('}', '');
	}

	const desktop = visible(t.text).filter(([, v]) => v.desktop);
	lines.push('@media (min-width: 1024px) {', '\t:root {');
	for (const [k, v] of desktop) {
		lines.push(`\t\t--text-${k}-size: ${px(v.desktop.size)};`);
		lines.push(`\t\t--text-${k}-line: ${px(v.desktop.line)};`);
	}
	lines.push('\t}', '}', '');

	const reduced = [`\t--shift: ${t.motion.shift.reduced};`, `\t--fx: ${t.motion.fx.reduced};`];
	lines.push("/* Reduce effects: slides become fades, loops and ambient effects stop. Durations stay. */");
	lines.push(":root[data-effects='reduced'] {", ...reduced, '}', '');
	lines.push('/* Before the setting is read, follow the OS. */');
	lines.push('@media (prefers-reduced-motion: reduce) {', "\t:root:not([data-effects]) {", ...reduced.map((l) => '\t' + l), '\t}', '}', '');
	return lines.join('\n');
}

export function toTs(t: TokenFile): string {
	const m = model(t);
	const branchHex = Object.fromEntries(Object.entries(m.branches).map(([id, b]) => [id, b.base]));
	const accents = Object.fromEntries(
		Object.entries(m.branches).map(([id, b]) => [id, { base: b.base, tint: b.tint, border: b.border, ambient: b.ambient, glow: b.glow, softGlow: b.softGlow }])
	);
	const roles = Object.fromEntries(Object.entries(m.roles).map(([k, v]) => [k, v.hex]));
	const text = Object.fromEntries(visible(t.text));
	const json = (v: unknown) => JSON.stringify(v, null, '\t');
	return [
		`// ${HEADER}`,
		'',
		`export const NEUTRAL = ${json(m.neutral)} as const;`,
		'',
		`export const HUE = ${json(m.hue)} as const;`,
		'',
		'/** Role colors. Screens and canvas code use these, not NEUTRAL or HUE directly. */',
		`export const ROLE = ${json({ ...roles, 'feedback-wrong-border': m.wrongBorder, scrim: m.scrim, 'card-edge': m.cardEdge })} as const;`,
		'',
		'/** One hue per curriculum branch, keyed by branch id. */',
		`export const BRANCH_COLORS = ${json(branchHex)} as const;`,
		'',
		'/** The accent set a screen gets from its branch. `none` is a screen with no branch. */',
		`export const ACCENTS = ${json({ none: { base: m.none.base, tint: m.none.tint, border: m.none.border, ambient: m.none.ambient, glow: m.none.glow, softGlow: m.none.softGlow }, ...accents })} as const;`,
		'',
		`export const TEXT = ${json(text)} as const;`,
		'',
		`export const SPACE = ${json(t.space)} as const;`,
		'',
		`export const RADIUS = ${json(t.radius)} as const;`,
		'',
		`export const MOTION = ${json(Object.fromEntries(visible(t.motion)))} as const;`,
		''
	].join('\n');
}

/** FigCraft local-variables JSON, the format `variable.import` reads. */
export function toFigcraft(t: TokenFile) {
	const m = model(t);
	const collections: Record<string, TokenFile> = {};
	const variables: Record<string, TokenFile> = {};
	let next = 1;
	const floatColor = (value: string) => {
		const match = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(value);
		const [r, g, b] = match ? match.slice(1, 4).map(Number) : rgb(value);
		const a = match ? Number(match[4]) : 1;
		return { r: +(r / 255).toFixed(4), g: +(g / 255).toFixed(4), b: +(b / 255).toFixed(4), a };
	};
	type Collection = { id: string; modeIds: Record<string, string> };
	const collection = (name: string, modes: string[]): Collection => {
		const id = `cd:c${next++}`;
		const modeIds = Object.fromEntries(modes.map((mode, i) => [mode, `${id}:m${i}`]));
		collections[id] = {
			id, key: id, name, remote: false, hiddenFromPublishing: false,
			defaultModeId: modeIds[modes[0]],
			modes: modes.map((mode) => ({ modeId: modeIds[mode], name: mode })),
			variableIds: []
		};
		return { id, modeIds };
	};
	const variable = (c: Collection, name: string, type: 'COLOR' | 'FLOAT' | 'STRING', valuesByModeName: Record<string, string | number>, web: string, scopes = ['ALL_SCOPES']) => {
		const id = `cd:v${next++}`;
		const valuesByMode = Object.fromEntries(
			Object.entries(valuesByModeName).map(([mode, v]) => [c.modeIds[mode], type === 'COLOR' ? floatColor(String(v)) : v])
		);
		variables[id] = {
			id, key: id, name, resolvedType: type, scopes, remote: false, hiddenFromPublishing: false,
			description: '', variableCollectionId: c.id, valuesByMode,
			codeSyntax: web ? { WEB: `var(--${web})` } : {}
		};
		collections[c.id].variableIds.push(id);
	};
	const one = (v: string | number) => ({ Value: v });

	const prim = collection('Primitives', ['Value']);
	for (const [k, v] of Object.entries(m.neutral)) variable(prim, `neutral/${k}`, 'COLOR', one(v), `neutral-${k}`);
	for (const [k, v] of Object.entries(m.hue)) variable(prim, `hue/${k}`, 'COLOR', one(v), `hue-${k}`);

	const color = collection('Color', ['Value']);
	for (const [k, v] of Object.entries(m.roles)) {
		const [group, ...rest] = k.split('-');
		variable(color, `${group}/${rest.join('-')}`, 'COLOR', one(v.hex), `color-${k}`);
	}
	variable(color, 'feedback/wrong-border', 'COLOR', one(m.wrongBorder), 'color-feedback-wrong-border');
	variable(color, 'overlay/scrim', 'COLOR', one(m.scrim), 'color-scrim');
	variable(color, 'overlay/card-edge', 'COLOR', one(m.cardEdge), 'color-card-edge');
	for (const [id, b] of Object.entries(m.branches)) {
		variable(color, `branch/${id}/base`, 'COLOR', one(b.base), `branch-${id}`);
		variable(color, `branch/${id}/tint`, 'COLOR', one(b.tint), `branch-${id}-tint`);
		variable(color, `branch/${id}/border`, 'COLOR', one(b.border), `branch-${id}-border`);
		variable(color, `branch/${id}/ambient`, 'COLOR', one(b.ambient), `branch-${id}-ambient`);
		variable(color, `branch/${id}/glow`, 'COLOR', one(b.glow), `branch-${id}-glow`);
	}

	const modeNames: Record<string, string> = { none: 'None', ...Object.fromEntries(Object.keys(m.branches).map((id) => [id, t['branch-name']?.[id] ?? id])) };
	const accent = collection('Accent', Object.values(modeNames));
	const sets: Record<string, Accent> = { none: m.none, ...m.branches };
	const parts: [keyof Accent, string][] = [['base', 'accent'], ['tint', 'accent-tint'], ['border', 'accent-border'], ['ambient', 'accent-ambient'], ['glow', 'accent-glow'], ['softGlow', 'accent-soft-glow']];
	for (const [part, web] of parts) {
		const values = Object.fromEntries(Object.entries(sets).map(([k, s]) => [modeNames[k], s[part]]));
		variable(accent, `accent/${part === 'softGlow' ? 'soft-glow' : part}`, 'COLOR', values, web);
	}

	const type = collection('Type', ['Phone', 'Desktop']);
	variable(type, 'font/sans', 'STRING', { Phone: t.font.sans, Desktop: t.font.sans }, 'font-sans', ['FONT_FAMILY']);
	variable(type, 'font/mono', 'STRING', { Phone: t.font.mono, Desktop: t.font.mono }, 'font-mono', ['FONT_FAMILY']);
	for (const [k, v] of visible(t.text)) {
		const d = v.desktop ?? v;
		variable(type, `text/${k}/size`, 'FLOAT', { Phone: v.size, Desktop: d.size }, `text-${k}-size`, ['FONT_SIZE']);
		variable(type, `text/${k}/line`, 'FLOAT', { Phone: v.line, Desktop: d.line }, `text-${k}-line`, ['LINE_HEIGHT']);
		variable(type, `text/${k}/weight`, 'FLOAT', { Phone: v.weight, Desktop: v.weight }, `text-${k}-weight`, ['FONT_WEIGHT']);
	}

	const space = collection('Space', ['Value']);
	for (const [k, v] of Object.entries(t.space as Record<string, number>)) variable(space, `space/${k}`, 'FLOAT', one(v), `space-${k}`, ['GAP', 'WIDTH_HEIGHT']);
	const radius = collection('Radius', ['Value']);
	for (const [k, v] of Object.entries(t.radius as Record<string, number>)) variable(radius, `radius/${k}`, 'FLOAT', one(v), `radius-${k}`, ['CORNER_RADIUS']);

	const motion = collection('Motion', ['Full', 'Reduced']);
	for (const [k, v] of Object.entries(t.motion.duration as Record<string, number>)) variable(motion, `duration/${k}`, 'FLOAT', { Full: v, Reduced: v }, `dur-${k}`);
	variable(motion, 'shift', 'FLOAT', { Full: t.motion.shift.full, Reduced: t.motion.shift.reduced }, 'shift');
	variable(motion, 'fx', 'FLOAT', { Full: t.motion.fx.full, Reduced: t.motion.fx.reduced }, 'fx');
	variable(motion, 'ease', 'STRING', { Full: t.motion.ease, Reduced: t.motion.ease }, 'ease');

	return { meta: { variableCollections: collections, variables } };
}
