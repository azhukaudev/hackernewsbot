import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HNStory } from '../src/hacker-news';
import { summarizeStory } from '../src/summarize';
import { mockFetch, urlContains } from './fetch-mock';
import { ARTICLE_HTML, mockAI } from './fixtures';

const ARTICLE_URL = 'https://example.com/post';
const story: HNStory = { id: 1, title: 'Title', url: ARTICLE_URL, score: 200 };

let aiRun: ReturnType<typeof mockAI>;

beforeEach(() => {
	aiRun = mockAI('- one\n* two\n1. three\n4. four');
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('summarizeStory', () => {
	it('returns null without calling AI when the story has no url', async () => {
		const result = await summarizeStory({ ...story, url: undefined });

		expect(result).toBeNull();
		expect(aiRun).not.toHaveBeenCalled();
	});

	it('returns null when the article text is below the minimum length', async () => {
		mockFetch([{ match: urlContains(ARTICLE_URL), respond: { body: '<p>short</p>', headers: { 'content-type': 'text/html' } } }]);

		expect(await summarizeStory(story)).toBeNull();
		expect(aiRun).not.toHaveBeenCalled();
	});

	it('returns null for non-HTML content without calling AI', async () => {
		mockFetch([{ match: urlContains(ARTICLE_URL), respond: { body: '%PDF-1.4', headers: { 'content-type': 'application/pdf' } } }]);

		expect(await summarizeStory(story)).toBeNull();
		expect(aiRun).not.toHaveBeenCalled();
	});

	it('extracts article text, summarizes, and returns at most 3 normalized bullets', async () => {
		mockFetch([{ match: urlContains(ARTICLE_URL), respond: { body: ARTICLE_HTML, headers: { 'content-type': 'text/html' } } }]);

		const result = await summarizeStory(story);

		expect(aiRun).toHaveBeenCalledOnce();
		expect(result).toEqual(['one', 'two', 'three']); // prefixes stripped, capped at 3
	});

	it('returns null when the AI call rejects', async () => {
		mockFetch([{ match: urlContains(ARTICLE_URL), respond: { body: ARTICLE_HTML, headers: { 'content-type': 'text/html' } } }]);
		aiRun.mockRejectedValueOnce(new Error('model unavailable'));

		expect(await summarizeStory(story)).toBeNull();
	});
});
