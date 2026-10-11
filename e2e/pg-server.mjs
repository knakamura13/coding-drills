/**
 * A real Postgres engine (PGlite) listening on a TCP port, so the e2e suite can
 * run the production build with DATABASE_URL set and exercise sign-in state and
 * cross-device sync without Docker. Started by playwright.config.ts.
 */

import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const port = Number(process.env.PG_PORT ?? 54329);

const db = await PGlite.create();
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 10 });
await server.start();
console.log(`pglite listening on ${port}`);

const stop = async () => {
	await server.stop();
	await db.close();
	process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
