import { defineEnvVars } from '@sveltejs/kit/env';

/**
 * Kit 3 only exposes environment variables named here. Each one is optional:
 * a deployment without Postgres or Google still serves the lessons.
 */
const optional = (value: string | undefined) => value;

export const variables = defineEnvVars({
	DATABASE_URL: {
		description: 'Postgres connection string. Absent, the account API stays off and progress stays on the device.',
		schema: optional
	},
	GOOGLE_CLIENT_ID: {
		description: 'Google OAuth client id. Absent, sign-in reports that it is not configured.',
		schema: optional
	},
	GOOGLE_CLIENT_SECRET: {
		description: 'Google OAuth client secret.',
		schema: optional
	},
	ALLOWED_EMAILS: {
		description: 'Comma-separated Google accounts that may sign in. Empty means nobody.',
		schema: optional
	}
});
