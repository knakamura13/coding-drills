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

async function evaluate() {
	const definition = await program(
		createRailwayContext({ command: 'plan', environment: 'production', projectName: 'coding-drills' }),
		project
	);
	const resources = (definition.resources ?? []).flat();
	return { definition, resources };
}

describe('.railway/railway.ts', () => {
	it('defines one project with a single web service and no database', async () => {
		const { definition, resources } = await evaluate();
		expect(definition.name).toBe('coding-drills');
		expect(resources.map((resource) => `${resource.type}.${resource.name}`)).toEqual(['service.web']);
	});

	it('deploys the main branch of this repository', async () => {
		const web = (await evaluate()).resources[0] as ServiceNode;
		expect(web.source).toEqual({
			type: 'github',
			repo: REPO_URL.replace('https://github.com/', ''),
			branch: 'main'
		});
	});

	it('builds from a Dockerfile that exists', async () => {
		const web = (await evaluate()).resources[0] as ServiceNode;
		expect(web.build?.builder).toBe('DOCKERFILE');
		expect(existsSync(join(root, web.build?.dockerfilePath ?? 'missing'))).toBe(true);
	});

	it('health-checks a route that exists', async () => {
		const web = (await evaluate()).resources[0] as ServiceNode;
		expect(web.deploy?.healthcheckPath).toBe('/healthz');
		expect(existsSync(join(root, 'src/routes/healthz/+server.ts'))).toBe(true);
	});

	it('only watches paths that exist', async () => {
		const web = (await evaluate()).resources[0] as ServiceNode;
		const patterns = web.build?.watchPatterns ?? [];
		expect(patterns.length).toBeGreaterThan(0);
		for (const pattern of patterns) {
			const path = pattern.replace(/^\//, '').replace(/\/\*\*$/, '');
			expect(existsSync(join(root, path)), `watch pattern ${pattern}`).toBe(true);
		}
	});
});
