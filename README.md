# coding-drills

Quiz drills for coding-interview topics, built around one rule: **a wrong answer is always followed by a follow-up question that checks why it was wrong.**

Each question asks for a pattern, a complexity, or an output. Pick wrongly and the lesson does not stop at showing the answer. It asks a second question aimed at the misconception behind your pick. Choose Two Pointers for a fixed-width window sum and the follow-up asks which detail points to a sliding window instead.

Live: https://coding-drills.up.railway.app

Status: early. Sixteen decks, spaced review, weak-spot and mixed practice, a progress screen, offline support, and optional Google sign-in that syncs progress between devices automatically.

## The lesson loop

1. Pick an option and press **Check**.
2. Right: a green sheet explains why. **Continue**.
3. Wrong: a red sheet shows the right answer. **See why again** opens the explanation for the option you picked and for the right one. **Continue** opens the follow-up written for the option you picked, with the original problem pinned above it.
4. The follow-up gets the same Check and feedback. A missed follow-up shows the answer and its explanation and moves on. Follow-ups do not have follow-ups.
5. The summary lists misses and follow-up results. The flag icon on any feedback sheet saves a bad question, and the summary links flags to prefilled GitHub issues.

## Finding your way

Every page outside a lesson has a top bar. The app name goes home, and the menu button opens a drawer with every section, the review and weak-spot counts, a link to Settings, and the install prompt. Settings holds sound, haptics, appearance, the shortcut switch, and sign-in. A lesson has no top bar, so leaving one uses the lesson's own control, which asks first.

Single-key shortcuts are on by default: 1 to 9 choose an answer in a lesson, and `/` moves to the filter on the Decks page. Settings turns them off.

## Spaced review

Every question you answer enters a schedule, and the home screen shows a **Review** card with what is due today (the ten most overdue per sitting). A review runs through the same lesson loop, follow-ups included.

- **Grading is by outcome.** Right first try is *good*. Wrong, then the follow-up right, is *hard*. Wrong twice is *again*. Speed is ignored.
- **The first attempt of the day counts.** Retaking a deck the same day is logged but does not move the schedule.
- **Intervals** follow the SM-2 family from learning-korean: 1 day, 3 days, then growing by the question's ease, capped at a year. *Again* resets to tomorrow.
- **The schedule is derived, never stored.** `src/lib/domain/srs.ts` replays the attempt log, so every device that holds the same attempts shows the same Review card. It is pure and takes the clock as a parameter.
- The home screen shows the day streak and the next deck to study. The Decks page shows progress for every deck, and the summary says when the next review is due.

## More ways to practice

- **Weak spots** (`/weak`): replays the questions you have failed most often (wrong, then the follow-up wrong too), up to ten, whether or not they are due. Ties go to the most recent miss.
- **Mixed practice** (`/practice`): ten random questions from every deck, or from one topic tag (`/practice?tag=hash-map`).
- **Progress** (`/progress`): a calendar of the last twelve weeks, plus streak, first-try accuracy, and learned counts per topic tag and per deck.

All three run through the same lesson loop, follow-ups included, and every answer feeds the review schedule exactly like a deck session. They are derived from the attempt log in `src/lib/domain/stats.ts` and `src/lib/review/`, so they sync across devices with no extra storage.

## Installable and offline

The app is a PWA. `static/manifest.webmanifest` makes it installable (with Review, Weak spots, and Practice shortcuts), and `src/service-worker.ts` caches the build, the static files, the prerendered pages, and the pages that render only in the browser (a lesson, review, weak spots, practice). Decks are compiled into the JavaScript, so every lesson works with no connection, and answers are saved on the device first and sync when the connection returns.

- Page loads go to the network first (4 second timeout) and fall back to the cache, so a deploy shows up on the next load. `/api/*` is never cached.
- A new version takes over immediately (`skipWaiting` and `clients.claim`) and the page reloads when the worker changes, so a deploy during a lesson can reload the page. Answered questions are already saved.
- The service worker is registered only in production builds (`src/lib/pwa/register.ts`), because in development it would cache stale modules.
- On Android, Chromium offers an Install button. On iPhone there is no install prompt, so the menu shows "tap Share, then Add to Home Screen" until dismissed.

## Accounts and sync

Signed out, the app is fully local: attempts and flags live in `localStorage`. Signing in with Google makes progress follow you between devices with no save step. It syncs on load, shortly after each answer, when the tab becomes visible, and when the connection returns.

- **Append-only attempt log.** Each answer is an event with a unique id. Devices exchange events and take the union, so two devices can never conflict, and a retried request stores nothing twice. Attempts recorded before signing in are uploaded on first sync.
- **Flags** merge by id, newest edit wins, and deletions sync as tombstones.
- **The server only stores events** (Postgres). It never computes schedules.
- **Access is one allow-listed Google account.** `ALLOWED_EMAILS` holds the comma-separated addresses that may sign in, and an empty value allows nobody. Sessions are opaque random tokens whose SHA-256 is stored, in an httpOnly cookie. The OAuth flow is authorization code with PKCE, written by hand in `src/lib/server/googleOauth.ts`.
- **Without `DATABASE_URL`** every `/api/*` route answers "unavailable" and the app stays local-only.

### Setting it up

1. `railway config apply` creates the Postgres service and wires `DATABASE_URL` (see below).
2. In Google Cloud console, create an OAuth client (type **Web application**) and add the authorized redirect URIs `https://<your-domain>/api/auth/google/callback` and `http://localhost:5173/api/auth/google/callback`. While the consent screen is in Testing mode, add your account as a test user.
3. Set these on the Railway service. They are never committed:

   | Variable | Value |
   | --- | --- |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | from the OAuth client |
   | `ALLOWED_EMAILS` | your Google address, comma-separated for several |
   | `ORIGIN` | the public origin, for example `https://coding-drills.up.railway.app` |

Local development with accounts: put the same variables in `.env` plus a `DATABASE_URL`. `node e2e/pg-server.mjs` starts a throwaway Postgres engine (PGlite) on port 54329, so Docker is not needed.

## Run it

```bash
pnpm install
pnpm dev      # http://localhost:5173, also reachable on your LAN for phone testing
```

| Command                      | What it does                                                            |
| ---------------------------- | ----------------------------------------------------------------------- |
| `pnpm check`                 | svelte-check, plus a type-check of `.railway/railway.ts`                |
| `pnpm test`                  | vitest: lesson rules, scheduling, sync, schema, storage, deck validation, and the SQL against a real Postgres engine (PGlite) |
| `pnpm test:e2e`              | builds the app, starts an in-process Postgres, and runs Playwright on desktop, Android, and iPhone, including two-device sync       |
| `pnpm build` / `pnpm start`  | production build, then the Node server on `$PORT`                       |

`pnpm test:e2e` runs desktop and Android (Chromium) and iPhone (WebKit) projects. Install the browsers with `pnpm exec playwright install chromium webkit`. With Chrome installed, `PW_CHANNEL=chrome pnpm test:e2e` reuses it for the Chromium projects.

## Decks

Decks are YAML files in `content/decks/`. The build validates them, and a deck with a wrong option that has no follow-up does not build. See [content/README.md](content/README.md) for the shape and for what makes a good follow-up. [content/ROADMAP.md](content/ROADMAP.md) maps every topic in the `py-coding-challenges` repo to a deck and says what is done, in review, or planned; a test keeps it in step with `content/decks/`.

## How it is built

- SvelteKit 2, Svelte 5, TypeScript, pnpm. Plain CSS with design tokens. No runtime dependencies in the client bundle beyond the framework.
- A Vite plugin compiles `content/decks/*.yaml` into virtual modules and validates them with zod at build time: a small index of deck titles and question ids for the menu, home, decks, and progress; and one lazily loaded module per deck, so a lesson downloads only its own deck.
- The lesson is a pure state machine (`src/lib/domain/lesson.ts`) with unit tests, including randomized play over every shipped deck. Svelte wraps it in `src/lib/lesson/controller.svelte.ts`.
- Attempts and flags are stored in `localStorage` first, so the app works offline and signed out. A signed-in device also syncs them to Postgres through `/api/sync`.
- `/play/[deckId]` renders on the client because option order is shuffled each run. Other pages are prerendered.
- Accessibility: the target is WCAG 2.2 AA. Options are native radio buttons, dialogs are native `<dialog>` elements that keep Tab inside while open, and axe scans run in the e2e suite. Single-key shortcuts can be switched off on the Settings page.
- Performance: each deck is its own module, so a lesson downloads one deck's content. The home screen reserves space for stored progress, and the e2e suite checks that it does not shift.

## Deploy on Railway

The Railway project is described in code in [`.railway/railway.ts`](.railway/railway.ts) ([Infrastructure as Code](https://docs.railway.com/infrastructure-as-code)): the app service (built from the `Dockerfile`, health-checked on `/healthz`), a Postgres database with a volume, and the variables the app reads. Variable values stay in Railway; the file only declares them with `preserve()`, and `DATABASE_URL` is a reference to the database's private hostname.

First deploy of a new Railway project:

```bash
railway init --name coding-drills   # creates the empty project and links this directory
railway config plan                 # read-only preview
railway config apply                # creates the service from the file
railway domain                      # generates the public *.up.railway.app domain, once
```

The service deploys from the `main` branch of this repo, so the Railway GitHub app needs access to it. After the first apply, every push to `main` redeploys. `railway link` attaches an existing project instead of creating one.

Railway never reads `.railway/railway.ts` during a deploy. Pushing or merging an edit changes nothing live until `railway config apply` runs, so the file and the project can quietly disagree. Run the read-only `railway config plan` before each apply, and apply right after merging any change to the file.

`railway config apply` also manages the whole project: a resource missing from the file is planned for deletion, and settings changed only in the dashboard can be overwritten by the next apply. Add new services and settings to the file rather than the dashboard.

## Roadmap

Not built yet: the remaining decks in [content/ROADMAP.md](content/ROADMAP.md) and XP.

## License

[MIT](LICENSE)
