// Writes the generated token files from design/tokens.json. Run with `pnpm tokens`.
import { readFileSync, writeFileSync } from 'node:fs';
import { toCss, toFigcraft, toTs } from '../src/lib/ui/tokens/build.ts';

const root = new URL('..', import.meta.url);
const tokens = JSON.parse(readFileSync(new URL('design/tokens.json', root), 'utf8'));

writeFileSync(new URL('src/lib/ui/tokens.css', root), toCss(tokens));
writeFileSync(new URL('src/lib/ui/tokens.ts', root), toTs(tokens));
writeFileSync(new URL('design/figcraft-variables.json', root), JSON.stringify(toFigcraft(tokens), null, '\t') + '\n');
console.log('Wrote src/lib/ui/tokens.css, src/lib/ui/tokens.ts and design/figcraft-variables.json');
