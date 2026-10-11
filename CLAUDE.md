# coding-drills

SvelteKit 2 (Svelte 5, TypeScript 6) quiz app for coding-interview drills. No backend. Decks live in `content/decks/*.yaml`. README.md has the product overview and `content/README.md` has the authoring guide.

## Commands

- `pnpm dev` serves on 5173 and on the LAN. `pnpm check` runs svelte-check plus a type-check of `.railway/railway.ts`. `pnpm test` runs vitest, which also validates every deck and evaluates `.railway/railway.ts`.
- `PW_CHANNEL=chrome pnpm test:e2e` builds the app, serves `build/`, and runs desktop and mobile suites with axe scans. `PW_CHANNEL=chrome` reuses the installed Chrome. CI installs Chromium instead.
- Use `pnpm`, never npm. Use `fd` and `rg`.

## Rules that are not obvious from the code

- Every wrong option needs exactly one follow-up, and the correct option has none. `src/lib/content/schema.ts` enforces it at build time. Fix the deck instead of loosening the schema.
- Lesson rules live in `src/lib/domain/lesson.ts` (pure and tested). `src/lib/lesson/controller.svelte.ts` only adds Svelte state and writes attempts and flags to localStorage. Keep rules out of components.
- `/play/[deckId]` is client-only (`ssr = false`) because option order is shuffled per run. Every other page is prerendered.
- The palette in `src/app.css` was sampled from the design reference. `--on-color` is deliberately darker than the page background to reach 4.5:1 contrast on the red and indigo buttons.
- Keep `@sveltejs/kit` on 2.x and `typescript` on 6.x. svelte-check does not support TypeScript 7 yet. Both are pinned to the lines `learning-korean` uses.
- The repo is public. Deck wording is original. Never commit screenshots, text copied from other apps, books, or sites, secrets, or personal data. Reference screenshots belong in `.reference/`, which is git-ignored.

## Railway

- `.railway/railway.ts` is the source of truth for the Railway project and manages it as a whole. Anything missing from the file is planned for deletion on apply. `railway.toml` and `railway.json` are deprecated (Railway stops reading them on 2026-12-01). Do not add either.
- Edits to `.railway/railway.ts` are not live until `railway config apply` runs (Railway never reads the file at deploy time). Plan before every apply, and apply right after merging a change to the file. Dashboard-only changes are not copied into the file and can be overwritten or deleted by the next apply.
- `railway config plan` is read-only. Do not run `railway config apply` or create Railway resources without the owner's explicit go-ahead.
- The generated `*.up.railway.app` domain cannot be expressed in the file. Generate it once with `railway domain`.
- The build comes from `Dockerfile`. CI builds the image and smoke-tests `/healthz`.

## Git

- Conventional Commits (`feat:`, `fix:`, `chore:`). No attribution lines in commit messages.
