/** The message a page sends its service worker to learn which build it is. The worker replies on the given port. */
export const VERSION_QUERY = 'facet:version';

/** How long a page waits for its worker to name its build. One that does not answer is treated as another build. */
export const VERSION_TIMEOUT_MS = 3000;
