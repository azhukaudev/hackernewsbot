import { env } from 'cloudflare:workers';
import { reset } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HNStory } from '../src/hacker-news';
import { publishNextTopStory } from '../src/pipeline';
import { PostedStore } from '../src/posted-store';
import { mockFetch, Route, urlContains } from './fetch-mock';
import { ARTICLE_HTML, mockAI } from './fixtures';

/** Routes for the HN top feed, the per-story items, the article page, and Telegram. */
function routes(topIds: number[], stories: HNStory[], telegramStatus = 200): Route[] {
	return [
		{ match: urlContains('/topstories.json'), respond: { body: JSON.stringify(topIds) } },
		...stories.map((s) => ({
			match: urlContains(`/item/${s.id}.json`),
			respond: { body: JSON.stringify(s) },
		})),
		{ match: urlContains('example.com'), respond: { body: ARTICLE_HTML, headers: { 'content-type': 'text/html' } } },
		{ match: urlContains('api.telegram.org'), respond: { status: telegramStatus, body: telegramStatus === 200 ? 'ok' : 'error' } },
	];
}

function story(id: number, score: number): HNStory {
	return { id, title: `Story ${id}`, url: `https://example.com/${id}`, score };
}

beforeEach(() => mockAI('- summary bullet'));

afterEach(async () => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	await reset(); // Clear KV so each test starts with no stories marked as posted.
});

describe('publishNextTopStory', () => {
	it('posts the first eligible story and marks it as posted', async () => {
		const telegram = mockFetch(routes([100], [story(100, 150)]));

		await publishNextTopStory();

		expect(telegram.mock.calls.some(([url]) => String(url).includes('api.telegram.org'))).toBe(true);
		expect(await env.HN_KV.get('posted:100')).toBe('1');
	});

	it('skips stories below the score threshold and posts the next eligible one', async () => {
		const telegram = mockFetch(routes([1, 2], [story(1, 50), story(2, 200)]));

		await publishNextTopStory();

		const sent = telegram.mock.calls.filter(([url]) => String(url).includes('api.telegram.org'));
		expect(sent).toHaveLength(1);
		expect(await env.HN_KV.get('posted:1')).toBeNull();
		expect(await env.HN_KV.get('posted:2')).toBe('1');
	});

	it('skips stories already recorded as posted', async () => {
		await new PostedStore(env.HN_KV).add(100);
		const telegram = mockFetch(routes([100], [story(100, 150)]));

		await publishNextTopStory();

		expect(telegram.mock.calls.some(([url]) => String(url).includes('api.telegram.org'))).toBe(false);
	});

	it('releases the claim when sending to Telegram fails', async () => {
		mockFetch(routes([100], [story(100, 150)], 500));

		await expect(publishNextTopStory()).rejects.toThrow();
		expect(await env.HN_KV.get('posted:100')).toBeNull();
	});

	it('does nothing when the top feed is empty', async () => {
		const telegram = mockFetch(routes([], []));

		await expect(publishNextTopStory()).resolves.toBeUndefined();
		expect(telegram.mock.calls.some(([url]) => String(url).includes('api.telegram.org'))).toBe(false);
	});
});
