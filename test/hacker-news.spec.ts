import { afterEach, describe, expect, it, vi } from 'vitest';

import { discussionUrl, fetchStoryById, fetchTopStoryIds } from '../src/hacker-news';
import { mockFetch, urlContains } from './fetch-mock';

afterEach(() => vi.unstubAllGlobals());

describe('discussionUrl', () => {
	it('builds the HN item url', () => {
		expect(discussionUrl(7)).toBe('https://news.ycombinator.com/item?id=7');
	});
});

describe('fetchTopStoryIds', () => {
	it('returns the parsed id array on success', async () => {
		mockFetch([{ match: urlContains('/topstories.json'), respond: { body: JSON.stringify([1, 2, 3]) } }]);

		expect(await fetchTopStoryIds()).toEqual([1, 2, 3]);
	});

	it('returns an empty array on a non-2xx response', async () => {
		mockFetch([{ match: urlContains('/topstories.json'), respond: { status: 500, body: 'boom' } }]);

		expect(await fetchTopStoryIds()).toEqual([]);
	});
});

describe('fetchStoryById', () => {
	it('returns the parsed story on success', async () => {
		const story = { id: 9, title: 'Hello', url: 'https://example.com', score: 120 };
		mockFetch([{ match: urlContains('/item/9.json'), respond: { body: JSON.stringify(story) } }]);

		expect(await fetchStoryById(9)).toEqual(story);
	});

	it('returns null on a non-2xx response', async () => {
		mockFetch([{ match: urlContains('/item/9.json'), respond: { status: 404, body: 'not found' } }]);

		expect(await fetchStoryById(9)).toBeNull();
	});
});
