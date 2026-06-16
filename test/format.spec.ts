import { describe, expect, it } from 'vitest';

import { HNStory } from '../src/hacker-news';
import { formatStoryMessage, storyPreviewUrl } from '../src/format';

const baseStory: HNStory = {
	id: 42,
	title: 'A Great Story',
	url: 'https://www.example.com/path',
	score: 250,
};

describe('formatStoryMessage', () => {
	it('renders title, Read domain (www stripped), and Discussion link', () => {
		const message = formatStoryMessage(baseStory);

		expect(message).toContain('<b>A Great Story</b>');
		expect(message).toContain('<b>Read:</b> <a href="https://www.example.com/path">example.com</a>');
		expect(message).toContain('<b>Discussion:</b> <a href="https://news.ycombinator.com/item?id=42">news.ycombinator.com</a>');
	});

	it('includes summary bullets when provided', () => {
		const message = formatStoryMessage(baseStory, ['First point', 'Second point']);

		expect(message).toContain('- First point');
		expect(message).toContain('- Second point');
	});

	it('omits bullets when summary is null or empty', () => {
		expect(formatStoryMessage(baseStory, null)).not.toContain('- ');
		expect(formatStoryMessage(baseStory, [])).not.toContain('- ');
	});

	it('omits the Read line for text posts without a url', () => {
		const message = formatStoryMessage({ ...baseStory, url: undefined });

		expect(message).not.toContain('<b>Read:</b>');
		expect(message).toContain('<b>Discussion:</b>');
	});

	it('escapes HTML in the title and bullets', () => {
		const message = formatStoryMessage({ ...baseStory, title: 'Tom & Jerry <fight>' }, ['a < b && c > d']);

		expect(message).toContain('<b>Tom &amp; Jerry &lt;fight&gt;</b>');
		expect(message).toContain('- a &lt; b &amp;&amp; c &gt; d');
	});
});

describe('storyPreviewUrl', () => {
	it('returns the article url when present', () => {
		expect(storyPreviewUrl(baseStory)).toBe('https://www.example.com/path');
	});

	it('falls back to the discussion url when there is no article', () => {
		expect(storyPreviewUrl({ ...baseStory, url: undefined })).toBe('https://news.ycombinator.com/item?id=42');
	});
});
