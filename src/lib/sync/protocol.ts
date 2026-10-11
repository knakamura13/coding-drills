import type { Attempt, Flag } from '$lib/storage/types';

/** The wire format of `POST /api/sync`, shared by the browser and the server. */

/** Attempts per request. Larger histories sync over several rounds. */
export const SYNC_BATCH = 500;
/** Attempts the server returns per response. */
export const SYNC_PAGE = 2000;
export const MAX_FLAGS = 1000;
/** Ceiling on a request body, in bytes. */
export const MAX_SYNC_BODY_BYTES = 1_000_000;

export interface SyncRequest {
	/** The newest server position this device has received. */
	cursor: number;
	/** Attempts the server has not acknowledged yet. */
	attempts: Attempt[];
	/** Every flag, including deletions. The set is small. */
	flags: Flag[];
}

export interface SyncResponse {
	/** Pass back as `cursor` on the next request. */
	cursor: number;
	/** Attempts the server holds past the request's cursor. May include ones this device just sent. */
	attempts: Attempt[];
	flags: Flag[];
	/** True when more attempts remain past this page. */
	more: boolean;
}

export interface Me {
	email: string;
	name: string | null;
}
