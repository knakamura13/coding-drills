import { defineRailway, github, project, service } from 'railway/iac';

/**
 * Railway infrastructure for coding-drills, as code.
 * See https://docs.railway.com/infrastructure-as-code
 *
 * One service, no database: decks are compiled into the bundle and progress
 * lives in the browser. The build comes from `Dockerfile` at the repo root.
 *
 * `railway config apply` manages the whole project, so anything created in the
 * dashboard that is missing from this file is a deletion candidate. Add new
 * services here instead of in the dashboard.
 *
 * Not expressible in this file: the generated `*.up.railway.app` domain. Create
 * it once after the first apply with `railway domain`.
 */
export default defineRailway(() => {
	const web = service('web', {
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
		}
	});

	return project('coding-drills', { resources: [web] });
});
