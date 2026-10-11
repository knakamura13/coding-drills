# coding-drills

Quiz drills for coding-interview topics, built around one rule: **a wrong answer is always followed by a follow-up question that checks why it was wrong.**

Each question asks for a pattern, a complexity, or an output. Pick wrongly and the lesson does not stop at showing the answer. It asks a second question aimed at the misconception behind your pick. Choose Two Pointers for a fixed-width window sum and the follow-up asks which detail points to a sliding window instead.

Status: MVP. One deck of five questions, progress stored on the device, no accounts.

## The lesson loop

1. Pick an option and press **Check**.
2. Right: a green sheet explains why. **Continue**.
3. Wrong: a red sheet shows the right answer. **See why again** opens the explanation for the option you picked and for the right one. **Continue** opens the follow-up written for the option you picked, with the original problem pinned above it.
4. The follow-up gets the same Check and feedback. A missed follow-up shows the answer and its explanation and moves on. Follow-ups do not have follow-ups.
5. The summary lists misses and follow-up results. The flag icon on any feedback sheet saves a bad question on the device, and the summary links flags to prefilled GitHub issues.

## Run it

```bash
pnpm install
pnpm dev      # http://localhost:5173, also reachable on your LAN for phone testing
```

| Command                      | What it does                                                            |
| ---------------------------- | ----------------------------------------------------------------------- |
| `pnpm check`                 | svelte-check, plus a type-check of `.railway/railway.ts`                |
| `pnpm test`                  | vitest: lesson rules, schema, storage, Markdown, deck validation        |
| `pnpm test:e2e`              | builds the app and runs Playwright on desktop and phone viewports       |
| `pnpm build` / `pnpm start`  | production build, then the Node server on `$PORT`                       |

`pnpm test:e2e` needs Chromium (`pnpm exec playwright install chromium`). With Chrome installed, `PW_CHANNEL=chrome pnpm test:e2e` reuses it.

## Decks

Decks are YAML files in `content/decks/`. The build validates them, and a deck with a wrong option that has no follow-up does not build. See [content/README.md](content/README.md) for the shape and for what makes a good follow-up.

## How it is built

- SvelteKit 2, Svelte 5, TypeScript, pnpm. Plain CSS with design tokens. No runtime dependencies in the client bundle beyond the framework.
- A Vite plugin compiles `content/decks/*.yaml` into a typed virtual module and validates it with zod at build time.
- The lesson is a pure state machine (`src/lib/domain/lesson.ts`) with unit tests, including randomized play over every shipped deck. Svelte wraps it in `src/lib/lesson/controller.svelte.ts`.
- Attempts and flags are stored in `localStorage`. There is no backend and no sync between devices.
- `/play/[deckId]` renders on the client because option order is shuffled each run. Other pages are prerendered.
- Accessibility: options are native radio buttons, dialogs are native `<dialog>` elements, and axe scans run in the e2e suite.

## Deploy on Railway

The Railway project is described in code in [`.railway/railway.ts`](.railway/railway.ts) ([Infrastructure as Code](https://docs.railway.com/infrastructure-as-code)). The service builds from the `Dockerfile` and is health-checked on `/healthz`.

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

Not in the MVP: spaced repetition from the attempt log, more decks, streaks and XP, offline support, and syncing progress between devices.

## License

[MIT](LICENSE)
