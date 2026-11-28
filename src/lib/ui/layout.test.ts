import { expect, it } from 'vitest';
import { shellLayout } from './layout';

it.each([
	[390, 844, 'portrait', 'sheet', 'fullscreen'],
	[844, 390, 'landscape', 'centered', 'drawer'],
	[1023, 1100, 'portrait', 'sheet', 'fullscreen'],
	[1024, 1100, 'desktop', 'centered', 'drawer'],
	[1440, 900, 'desktop', 'centered', 'drawer']
] as const)('selects surfaces at %i by %i', (width, height, layout, dialog, view) => {
	expect(shellLayout(width, height)).toEqual({ layout, dialog, view });
});
