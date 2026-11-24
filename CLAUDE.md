# coding-drills

SvelteKit 3 (Svelte 5, TypeScript 6) quiz app for coding-interview drills. Local-first, with optional Google sign-in that syncs attempts and flags to Postgres. Decks live in `content/decks/*.yaml`. README.md has the product overview and `content/README.md` has the authoring guide.

## Commands

- `pnpm dev` serves on 5173 and on the LAN. `pnpm check` runs svelte-check plus a type-check of `.railway/railway.ts`. `pnpm test` runs vitest, which also validates every deck, evaluates `.railway/railway.ts`, and runs the SQL against PGlite.
- `PW_CHANNEL=chrome pnpm test:e2e` builds the app, serves `build/`, and runs desktop, Android (Chromium), and iPhone (WebKit) suites with axe scans. `PW_CHANNEL=chrome` only affects the Chromium projects, and WebKit needs `pnpm exec playwright install webkit`. CI installs both browsers.
- Use `pnpm`, never npm. Use `fd` and `rg`.
- Never use Fable 5.1 sub-agents in this project (the owner's standing rule). Leave an Agent call's `model` unset or choose another model explicitly.

## Rules that are not obvious from the code

- Every wrong option needs exactly one follow-up, and the correct option has none. `src/lib/content/schema.ts` enforces it at build time. Fix the deck instead of loosening the schema.
- The attempt log is the source of truth. Never store a schedule: `src/lib/domain/srs.ts` derives it by replaying attempts in `(at, id)` order, counting only the first attempt per question per `day`. Devices exchange attempts by id and take the union, so nothing can conflict. Change scheduling rules there and every device re-derives.
- Attempts carry a stored `day` (the learner's local date) so every device groups them the same way. Day math goes through UTC in `src/lib/domain/days.ts`.
- Sync lives in `src/lib/sync/` (client engine, store) and `src/lib/server/` + `src/routes/api/` (Postgres, Google OAuth, sessions). `repo.integration.test.ts` runs one contract against an in-memory fake and a real Postgres engine (PGlite). Keep the fake in `src/lib/testing/memoryRepo.ts` in step with the SQL.
- Sign-in is allow-listed by `ALLOWED_EMAILS`. An empty value allows nobody. Never log or echo the Google client secret or session tokens, and never put secrets in `.railway/railway.ts` (use `preserve()`).
- e2e runs the production build against PGlite (`e2e/pg-server.mjs`) with `ORIGIN` set. adapter-node assumes `https` without `ORIGIN` or `PROTOCOL_HEADER`, which makes the API's origin check reject every write. The Dockerfile sets the proxy headers for Railway.
- Weak spots, mixed practice, and the Progress screen are all derived from the attempt log (`src/lib/review/`, `src/lib/domain/stats.ts`). They reuse `createReviewLesson` and the lesson loop. Do not add storage for them.
- `src/service-worker.ts` caches the app for offline use and takes over immediately on a new version. It must never touch `/api/*`. Client-only routes (`/play/*`, `/exam/*`, `/review`, `/weak`, `/practice`) are cached as shells at install, so a new client-only route must be added to `CLIENT_ROUTES` there. The worker is registered only in production builds.
- Every deck must appear in `content/ROADMAP.md` (a test enforces it). Add the row, or change its status, in the same commit as the deck.
- Decks are authored by hand and then reviewed adversarially: run every code snippet in Python before putting an output in an explanation, and check that no wrong option is also defensibly correct. The writer and reviewer process is the `drills:content-review` skill (see AGENTS.md).
- Lesson rules live in `src/lib/domain/lesson.ts` (pure and tested). `src/lib/lesson/controller.svelte.ts` only adds Svelte state and writes attempts and flags to localStorage. Keep rules out of components.
- `/play/[deckId]` is client-only (`ssr = false`) because option order is shuffled per run. Every other page is prerendered.
- The palette in `src/app.css` was sampled from the design reference. `--on-color` is deliberately darker than the page background to reach 4.5:1 contrast on the red and indigo buttons.
- Keep `@sveltejs/kit` on 3.x and `typescript` on 6.x. svelte-check does not support TypeScript 7 yet. Kit 2.x cannot clear the published `query.batch` and remote-form advisories; 3.1.1 is the lowest release that does.
- The repo is public. Deck wording is original. Never commit screenshots, text copied from other apps, books, or sites, secrets, or personal data. Reference screenshots belong in `.reference/`, which is git-ignored.

## Mastery tree

The app is being rebuilt as a branching skill tree with lessons, checkpoint exams and spaced review. Issue #9 is the tracker, and the issues and PRs hold the detail (decisions, design plans, open questions). Read them before changing the tree.

- Every question in `content/decks` must be mapped to a skill path in `content/curriculum/<branch>.yaml`, or the build fails. The mapping fields are in `content/README.md` ("Mapping a deck onto the tree").
- A question has one of four formats: multiple choice, tap-cell, drag-pointers or step-trace. Schemas are in `src/lib/content/schema.ts` and authoring notes in `content/README.md`. A new format must make the learner produce the answer and explain each wrong answer in place (#18), and must work by touch and by mouse and keyboard, in portrait and landscape (#15).
- Skill state, exam passing, locking and review are derived from the attempt log in `src/lib/domain/mastery.ts` and `exam.ts`. Store nothing for them. The design is on #32 (exams) and #19 (review).
- Open work: undrafted paths #62, topics no path teaches #64, fresh review variants #41, the app icon #28.
- Lessons, drills and exams are planned and written by Opus 5.5 High sub-agents (the owner's rule), then reviewed adversarially.

## Railway

- `.railway/railway.ts` is the source of truth for the Railway project and manages it as a whole. Anything missing from the file is planned for deletion on apply. `railway.toml` and `railway.json` are deprecated (Railway stops reading them on 2026-12-01). Do not add either.
- Edits to `.railway/railway.ts` are not live until `railway config apply` runs (Railway never reads the file at deploy time). Plan before every apply, and apply right after merging a change to the file. Dashboard-only changes are not copied into the file and can be overwritten or deleted by the next apply.
- `railway config plan` is read-only. Do not run `railway config apply` or create Railway resources without the owner's explicit go-ahead.
- The generated `*.up.railway.app` domain cannot be expressed in the file. Generate it once with `railway domain`.
- The build comes from `Dockerfile`. CI builds the image and smoke-tests `/healthz`.

## Git

- Conventional Commits (`feat:`, `fix:`, `chore:`). No attribution lines in commit messages.
- Rebase-merge a PR only once CI is green on its head commit (`gh pr merge --rebase --match-head-commit <sha>`), and delete the branch after. Two open PRs that edit `content/ROADMAP.md` or the curriculum files conflict, so merge them one at a time.
