import { env } from 'cloudflare:workers';
import { reset } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';

import { PostedStore } from '../src/posted-store';

afterEach(() => reset()); // Clear KV between tests.

describe('PostedStore', () => {
	it('reports false for a story that was never added', async () => {
		const store = new PostedStore(env.HN_KV);

		expect(await store.has(123)).toBe(false);
	});

	it('reports true after a story is added', async () => {
		const store = new PostedStore(env.HN_KV);

		await store.add(123);

		expect(await store.has(123)).toBe(true);
	});

	it('writes the marker under the posted: key prefix', async () => {
		const store = new PostedStore(env.HN_KV);

		await store.add(456);

		expect(await env.HN_KV.get('posted:456')).toBe('1');
	});

	it('clears the marker on remove', async () => {
		const store = new PostedStore(env.HN_KV);

		await store.add(789);
		await store.remove(789);

		expect(await store.has(789)).toBe(false);
	});
});
