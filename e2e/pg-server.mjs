/**
 * A real Postgres engine (PGlite) listening on a TCP port, so the e2e suite can
 * run the production build with DATABASE_URL set and exercise sign-in state and
 * cross-device sync without Docker. Started by playwright.config.ts.
 *
 * PGlite is one backend, so every client connection shares one session: one
 * unnamed statement, one unnamed portal, one transaction. pglite-socket's
 * server interleaves connections message by message, which lets another
 * connection's messages run between this one's Parse, Bind and Execute and drop
 * its unnamed portal (`portal "" does not exist`). postgres.js also sends
 * Parse/Describe/Flush and waits for the reply before it sends Bind/Execute/Sync.
 *
 * So this front end gives the backend to one connection at a time. A connection
 * takes it at the first message of a batch and keeps it until a response ends
 * in ReadyForQuery with status idle: after Sync or a simple Query, or at the end
 * of an explicit transaction. Messages run as they arrive, so a Flush gets its
 * reply.
 */

import { createServer } from 'node:net';
import { PGlite } from '@electric-sql/pglite';

const port = Number(process.env.PG_PORT ?? 54329);
const SSL_REQUEST = 80877103;
const GSSENC_REQUEST = 80877104;
const CANCEL_REQUEST = 80877102;
const SYNC = new Uint8Array([0x53, 0, 0, 0, 4]);

const db = await PGlite.create();

/** The connection that holds the backend, and the connections waiting for it in arrival order. */
let owner = null;
const waiting = [];

function acquire(conn) {
	if (owner === null || owner === conn) {
		owner = conn;
		return Promise.resolve();
	}
	return new Promise((resolve) => waiting.push({ conn, resolve }));
}

function release(conn) {
	if (owner !== conn) return;
	const next = waiting.shift();
	owner = next ? next.conn : null;
	next?.resolve();
}

/** Runs one frontend message and returns the status of a trailing ReadyForQuery, or null. */
async function run(message, onData) {
	const chunks = [];
	await db.runExclusive(() =>
		db.execProtocolRawStream(message, {
			onRawData: (data) => {
				const copy = Buffer.from(data);
				chunks.push(copy);
				onData(copy);
			}
		})
	);
	const out = Buffer.concat(chunks);
	let status = null;
	for (let at = 0; at + 5 <= out.length; at += 1 + out.readInt32BE(at + 1)) {
		status = out[at] === 0x5a ? String.fromCharCode(out[at + 5]) : null;
	}
	return status;
}

function serve(socket) {
	socket.setNoDelay(true);
	const conn = { closed: false };
	let buffer = Buffer.alloc(0);
	// Until the startup packet has been framed, packets have no type byte.
	let typed = false;
	let work = Promise.resolve();
	const write = (data) => {
		if (!conn.closed && socket.writable) socket.write(data);
	};

	async function handle(message, untyped) {
		if (conn.closed) return;
		if (untyped) {
			const code = message.readInt32BE(4);
			if (code === SSL_REQUEST || code === GSSENC_REQUEST) return write('N');
			// PGlite has no backend process to signal, so a cancel request is dropped.
			if (code === CANCEL_REQUEST) return socket.destroy();
		} else if (message[0] === 0x58) {
			// Terminate: the session is shared, so it is never passed to PGlite.
			return socket.end();
		}
		await acquire(conn);
		if (conn.closed) return;
		const status = await run(new Uint8Array(message), write);
		if (status === 'I') release(conn);
	}

	/** Gives the backend back after a disconnect, ending a half-sent batch or an open transaction. */
	async function abandon() {
		// handle() waits for the backend inside this chain, so this connection is never still queued here.
		if (owner !== conn) return;
		try {
			if ((await run(SYNC, () => {})) !== 'I') await db.exec('ROLLBACK');
		} finally {
			release(conn);
		}
	}

	// A failed message closes this connection, not the server.
	const fail = (error) => {
		console.error('pglite connection failed:', error);
		socket.destroy();
	};

	socket.on('data', (data) => {
		buffer = Buffer.concat([buffer, data]);
		for (;;) {
			const header = typed ? 5 : 4;
			if (buffer.length < header) break;
			const length = typed ? 1 + buffer.readInt32BE(1) : buffer.readInt32BE(0);
			if (!typed && length < 8) return socket.destroy();
			if (buffer.length < length) break;
			const message = buffer.subarray(0, length);
			buffer = buffer.subarray(length);
			const untyped = !typed;
			// A protocol 3.x startup packet; SSL, GSSAPI and cancel requests are not.
			if (untyped && message.readInt32BE(4) >> 16 === 3) typed = true;
			work = work.then(() => handle(message, untyped)).catch(fail);
		}
	});

	const close = () => {
		if (conn.closed) return;
		conn.closed = true;
		work = work.then(abandon).catch((error) => console.error('pglite cleanup failed:', error));
	};
	socket.on('close', close);
	socket.on('error', close);
}

const server = createServer(serve);
await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
console.log(`pglite listening on ${port}`);

const stop = async () => {
	server.close();
	await db.close();
	process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
