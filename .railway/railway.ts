import { defineRailway, github, postgres, preserve, project, service, volume } from 'railway/iac';

/**
 * Railway infrastructure for coding-drills, as code.
 * See https://docs.railway.com/infrastructure-as-code
 *
 * Two resources: the app and a Postgres database for cross-device sync. Decks
 * are compiled into the bundle, and the database holds each signed-in
 * learner's attempts and flags. The app reaches it over Railway's private
 * network through the DATABASE_URL reference below. The build comes from
 * `Dockerfile` at the repo root.
 *
 * Variable values stay in Railway (`preserve()`):
 * - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET: the Google OAuth client.
 * - ALLOWED_EMAILS: comma-separated Google accounts that may sign in. Empty
 *   means nobody can, so a missing value fails closed.
 * - ORIGIN: the public origin, for example https://coding-drills.up.railway.app.
 *   Needed because the Google redirect URI and the API's origin check use it.
 *
 * Railway never reads this file during a deploy. Editing or merging it changes
 * nothing live until `railway config apply` runs, so run the read-only
 * `railway config plan` first and apply right after merging any change here.
 *
 * `railway config apply` manages the whole project, so anything created in the
 * dashboard that is missing from this file is a deletion candidate. Add new
 * services here instead of in the dashboard.
 *
 * Not expressible in this file: the generated `*.up.railway.app` domain. Create
 * it once after the first apply with `railway domain`.
 */
export default defineRailway(() => {
	const database = postgres('Postgres', { region: 'us-west2' });
	database.networking = { privateNetworkEndpoint: 'postgres' };

	const databaseVolume = volume('postgres-volume', {
		alerts: { usage: { '100': {}, '80': {}, '95': {} } },
		allowOnlineResize: true,
		region: 'us-west2',
		// Attempts are a few hundred bytes each. A year of daily use fits in a few megabytes.
		sizeMB: 500
	});

	const app = service('Coding Drills App', {
		source: github('knakamura13/coding-drills', { branch: 'main' }),
		build: {
			builder: 'DOCKERFILE',
			dockerfilePath: 'Dockerfile',
			// Redeploy only when something that ships changes. README, e2e, and CI
			// edits do not need a new build.
			watchPatterns: [
				'/src/**',
				'/static/**',
				'/content/**',
				'/package.json',
				'/pnpm-lock.yaml',
				'/svelte.config.js',
				'/vite.config.ts',
				'/tsconfig.json',
				'/Dockerfile',
				'/.dockerignore'
			]
		},
		deploy: {
			healthcheckPath: '/healthz',
			healthcheckTimeout: 30,
			restartPolicyType: 'ON_FAILURE',
			restartPolicyMaxRetries: 3
		},
		// Values live in Railway. `preserve()` keeps them, because a variable that is
		// missing from this file is planned for deletion on apply.
		env: {
			// Resolves to the private hostname (postgres.railway.internal), never the public proxy.
			DATABASE_URL: database.env.DATABASE_URL,
			GOOGLE_CLIENT_ID: preserve(),
			GOOGLE_CLIENT_SECRET: preserve(),
			ALLOWED_EMAILS: preserve(),
			ORIGIN: preserve()
		}
	});

	return project('coding-drills', { resources: [database, app, databaseVolume] });
});
