import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRailwayContext, project, type ServiceNode } from 'railway/iac';
import { describe, expect, it } from 'vitest';
import program from '../../../.railway/railway.ts';
import { REPO_URL } from '../config';

/**
 * Evaluates `.railway/railway.ts` offline, the same way `railway config plan`
 * does, and checks it against the repo. These catch the drift a plan cannot:
 * a healthcheck route that was renamed, a watch pattern for a folder that no
 * longer exists, or a Dockerfile that moved.
 */

const root = process.cwd();

/** The app service among the resources. */
function appOf(resources: { type: string }[]): ServiceNode {
	return resources.find((resource) => resource.type === 'service') as ServiceNode;
}

async function evaluate() {
	const definition = await program(
		createRailwayContext({ command: 'plan', environment: 'production', projectName: 'coding-drills' }),
		project
	);
	const resources = (definition.resources ?? []).flat();
	return { definition, resources };
}

describe('.railway/railway.ts', () => {
	it('defines the app, its Postgres database, and the database volume', async () => {
		const { definition, resources } = await evaluate();
		expect(definition.name).toBe('coding-drills');
		expect(resources.map((resource) => `${resource.type}.${resource.name}`).sort()).toEqual([
			'database.Postgres',
			'service.Coding Drills App',
			'volume.postgres-volume'
		]);
	});

	it('deploys the main branch of this repository', async () => {
		const web = appOf((await evaluate()).resources);
		expect(web.source).toEqual({
			type: 'github',
			repo: REPO_URL.replace('https://github.com/', ''),
			branch: 'main'
		});
	});

	it('builds from a Dockerfile that exists', async () => {
		const web = appOf((await evaluate()).resources);
		expect(web.build?.builder).toBe('DOCKERFILE');
		expect(existsSync(join(root, web.build?.dockerfilePath ?? 'missing'))).toBe(true);
	});

	it('health-checks a route that exists', async () => {
		const web = appOf((await evaluate()).resources);
		expect(web.deploy?.healthcheckPath).toBe('/healthz');
		expect(existsSync(join(root, 'src/routes/healthz/+server.ts'))).toBe(true);
	});

	it('only watches paths that exist', async () => {
		const web = appOf((await evaluate()).resources);
		const patterns = web.build?.watchPatterns ?? [];
		expect(patterns.length).toBeGreaterThan(0);
		for (const pattern of patterns) {
			const path = pattern.replace(/^\//, '').replace(/\/\*\*$/, '');
			expect(existsSync(join(root, path)), `watch pattern ${pattern}`).toBe(true);
		}
	});

	it('points DATABASE_URL at the database and keeps the variables whose values live in Railway', async () => {
		const app = appOf((await evaluate()).resources);
		const variables = app.variables ?? {};
		expect(Object.keys(variables).sort()).toEqual([
			'ALLOWED_EMAILS',
			'DATABASE_URL',
			'GOOGLE_CLIENT_ID',
			'GOOGLE_CLIENT_SECRET',
			'ORIGIN'
		]);
		// Everything but DATABASE_URL is a secret or a per-deployment value that only Railway holds.
		for (const [name, value] of Object.entries(variables)) {
			if (name !== 'DATABASE_URL') expect(value, name).toEqual({ type: 'preserve' });
		}
		expect(variables.DATABASE_URL).toMatchObject({ type: 'reference' });
	});
});
