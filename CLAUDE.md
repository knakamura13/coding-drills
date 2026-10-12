# coding-drills

SvelteKit 2 (Svelte 5, TypeScript 6) quiz app for coding-interview drills. Local-first, with optional Google sign-in that syncs attempts and flags to Postgres. Decks live in `content/decks/*.yaml`. README.md has the product overview and `content/README.md` has the authoring guide.

## Commands

- `pnpm dev` serves on 5173 and on the LAN. `pnpm check` runs svelte-check plus a type-check of `.railway/railway.ts`. `pnpm test` runs vitest, which also validates every deck, evaluates `.railway/railway.ts`, and runs the SQL against PGlite.
- `PW_CHANNEL=chrome pnpm test:e2e` builds the app, serves `build/`, and runs desktop, Android (Chromium), and iPhone (WebKit) suites with axe scans. `PW_CHANNEL=chrome` only affects the Chromium projects, and WebKit needs `pnpm exec playwright install webkit`. CI installs both browsers.
- Use `pnpm`, never npm. Use `fd` and `rg`.

## Rules that are not obvious from the code

- Every wrong option needs exactly one follow-up, and the correct option has none. `src/lib/content/schema.ts` enforces it at build time. Fix the deck instead of loosening the schema.
- The attempt log is the source of truth. Never store a schedule: `src/lib/domain/srs.ts` derives it by replaying attempts in `(at, id)` order, counting only the first attempt per question per `day`. Devices exchange attempts by id and take the union, so nothing can conflict. Change scheduling rules there and every device re-derives.
- Attempts carry a stored `day` (the learner's local date) so every device groups them the same way. Day math goes through UTC in `src/lib/domain/days.ts`.
- Sync lives in `src/lib/sync/` (client engine, store) and `src/lib/server/` + `src/routes/api/` (Postgres, Google OAuth, sessions). `repo.integration.test.ts` runs one contract against an in-memory fake and a real Postgres engine (PGlite). Keep the fake in `src/lib/testing/memoryRepo.ts` in step with the SQL.
- Sign-in is allow-listed by `ALLOWED_EMAILS`. An empty value allows nobody. Never log or echo the Google client secret or session tokens, and never put secrets in `.railway/railway.ts` (use `preserve()`).
- e2e runs the production build against PGlite (`e2e/pg-server.mjs`) with `ORIGIN` set. adapter-node assumes `https` without `ORIGIN` or `PROTOCOL_HEADER`, which makes the API's origin check reject every write. The Dockerfile sets the proxy headers for Railway.
- Weak spots, mixed practice, and the Progress screen are all derived from the attempt log (`src/lib/review/`, `src/lib/domain/stats.ts`). They reuse `createReviewLesson` and the lesson loop. Do not add storage for them.
- `src/service-worker.ts` caches the app for offline use and takes over immediately on a new version. It must never touch `/api/*`. Client-only routes (`/play/*`, `/review`, `/weak`, `/practice`) are cached as shells at install, so a new client-only route must be added to `CLIENT_ROUTES` there. The worker is registered only in production builds.
- Decks are authored by hand and then reviewed adversarially: run every code snippet in Python before putting an output in an explanation, and check that no wrong option is also defensibly correct.
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
