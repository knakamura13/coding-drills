import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/env', () => ({ dev: false, version: 'build-2' }));

const { registerServiceWorker } = await import('./register');
const { VERSION_QUERY, VERSION_TIMEOUT_MS } = await import('./protocol');

/** A worker that answers the version query with `build`, or never answers when `build` is undefined. */
function worker(build: string | undefined) {
	return {
		postMessage: vi.fn((message: unknown, [port]: MessagePort[]) => {
			if (message === VERSION_QUERY && build !== undefined) port.postMessage(build);
		})
	};
}

/** A page whose service worker container starts with `controller`, plus a reload spy. */
function browser(controller: ReturnType<typeof worker> | null) {
	const container = Object.assign(new EventTarget(), {
		controller,
		register: vi.fn(() => Promise.resolve({ update: vi.fn(() => Promise.resolve()) }))
	});
	const reload = vi.fn();
	vi.stubGlobal('navigator', { serviceWorker: container });
	vi.stubGlobal('location', { reload });
	vi.stubGlobal('document', new EventTarget());
	registerServiceWorker();
	return {
		reload,
		/** Hands the page to `next` and fires the event. */
		takeOver(next: ReturnType<typeof worker> | null) {
			container.controller = next;
			container.dispatchEvent(new Event('controllerchange'));
		}
	};
}

/** Lets a worker's reply cross the message channel. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('registerServiceWorker', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('does not reload when the first worker is this build', async () => {
		const page = browser(null);
		page.takeOver(worker('build-2'));
		await settle();
		expect(page.reload).not.toHaveBeenCalled();
	});

	it('does not reload when the first worker is this build, even if it claimed the page before registration (#191)', async () => {
		// WebKit can set the controller before mount and fire controllerchange just after.
		const first = worker('build-2');
		const page = browser(first);
		page.takeOver(first);
		await settle();
		expect(page.reload).not.toHaveBeenCalled();
	});

	it('reloads once when another build takes over', async () => {
		const page = browser(worker('build-1'));
		const next = worker('build-3');
		page.takeOver(next);
		page.takeOver(next);
		await settle();
		expect(page.reload).toHaveBeenCalledTimes(1);
	});

	it('reloads when the worker does not say which build it is', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		const page = browser(null);
		page.takeOver(worker(undefined));
		await vi.advanceTimersByTimeAsync(VERSION_TIMEOUT_MS - 1);
		expect(page.reload).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(page.reload).toHaveBeenCalledTimes(1);
	});

	it('reloads when the worker that took over can no longer be asked', async () => {
		const page = browser(null);
		page.takeOver({
			postMessage: vi.fn(() => {
				throw new DOMException('The worker is redundant.', 'InvalidStateError');
			})
		});
		await settle();
		expect(page.reload).toHaveBeenCalledTimes(1);
	});

	it('does not reload when the worker goes away', async () => {
		const page = browser(worker('build-2'));
		page.takeOver(null);
		await settle();
		expect(page.reload).not.toHaveBeenCalled();
	});
});
