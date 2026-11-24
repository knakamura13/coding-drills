/**
 * A deck or curriculum file that breaks a content rule. Kept apart from the Node-only loaders so
 * browser code (the curriculum checks) can throw it without importing `node:fs`.
 */
export class ContentError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ContentError';
	}
}
