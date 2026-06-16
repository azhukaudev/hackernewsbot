import { vi } from 'vitest';

/** A canned response for a matched route. */
export interface RouteResponse {
	status?: number;
	body?: string;
	headers?: Record<string, string>;
}

type Responder = RouteResponse | ((url: string, init?: RequestInit) => RouteResponse | Promise<RouteResponse>);

export interface Route {
	/** Returns true when this route should handle the given request url. */
	match: (url: string) => boolean;
	respond: Responder;
}

/**
 * Replaces `globalThis.fetch` with a router over the given routes. Tests run in
 * the same isolate as the Worker, so this intercepts the Worker's own outbound
 * `fetch()` calls. Any request that matches no route throws, keeping tests
 * hermetic — an unmocked call is a test failure, not a real network hit.
 *
 * Returns the mock so callers can assert on `.mock.calls`. Pair with
 * `vi.unstubAllGlobals()` in `afterEach`.
 */
export function mockFetch(routes: Route[]) {
	const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
		const route = routes.find((r) => r.match(url));
		if (!route) {
			throw new Error(`Unexpected fetch to ${url}`);
		}

		const result = typeof route.respond === 'function' ? await route.respond(url, init) : route.respond;
		return new Response(result.body ?? '', {
			status: result.status ?? 200,
			headers: result.headers,
		});
	});

	vi.stubGlobal('fetch', fn);
	return fn;
}

/** Convenience matcher: url contains the given substring. */
export function urlContains(substring: string): (url: string) => boolean {
	return (url) => url.includes(substring);
}
