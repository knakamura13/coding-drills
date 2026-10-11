import { defineRailway, github, preserve, project, service } from 'railway/iac';

/**
 * Railway infrastructure for coding-drills, as code.
 * See https://docs.railway.com/infrastructure-as-code
 *
 * One service, no database: decks are compiled into the bundle and progress
 * lives in the browser. The build comes from `Dockerfile` at the repo root.
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
			GOOGLE_CLIENT_ID: preserve(),
			GOOGLE_CLIENT_SECRET: preserve()
		}
	});

	return project('coding-drills', { resources: [app] });
});
