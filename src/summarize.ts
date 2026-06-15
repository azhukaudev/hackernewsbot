import { env } from 'cloudflare:workers';

import { HNStory } from './hacker-news';

/** Workers AI model used for summaries. */
const SUMMARY_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

/** Upper bound on article text sent to the model, to cap latency and cost. */
const MAX_ARTICLE_CHARS = 6000;

/** Below this, the page likely yielded no real content (paywall, JS app, PDF). */
const MIN_ARTICLE_CHARS = 200;

/** Abort a slow article fetch so it can't drag a run into the next cron tick. */
const FETCH_TIMEOUT_MS = 10_000;

/** Elements whose text reads as article body. */
const CONTENT_SELECTOR = 'article, p, h1, h2, h3, li';

/**
 * Returns 2–3 short TL;DR bullets for a story's linked article, or null when
 * there's nothing to summarize (text post, unreachable page, model failure).
 * Best-effort: every failure is logged and collapses to null so posting is
 * never blocked.
 */
export async function summarizeStory(story: HNStory): Promise<string[] | null> {
	if (!story.url) {
		return null; // Ask HN / Show HN / job posts have no external article.
	}

	const articleText = await fetchArticleText(story.url);
	if (!articleText || articleText.length < MIN_ARTICLE_CHARS) {
		return null;
	}

	try {
		const result = await env.AI.run(SUMMARY_MODEL, {
			messages: [
				{
					role: 'system',
					content:
						'You summarize web articles into 2-3 short, factual bullet points. ' +
						'Output only the bullets, one per line, with no preamble, numbering, or closing remarks.',
				},
				{
					role: 'user',
					content: `Title: ${story.title}\n\nArticle:\n${articleText}`,
				},
			],
		});

		const text = typeof result === 'string' ? result : 'response' in result ? result.response : '';
		return parseBullets(text);
	} catch (error) {
		console.error('Failed to summarize story:', error);
		return null;
	}
}

/** Fetches a page and extracts readable body text via HTMLRewriter. */
async function fetchArticleText(url: string): Promise<string | null> {
	try {
		const response = await fetch(url, {
			headers: { 'User-Agent': 'hackernewsbot/1.0 (+https://news.ycombinator.com)' },
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		});
		if (!response.ok) {
			throw new Error(`Article request failed with status ${response.status}`);
		}
		if (!response.headers.get('content-type')?.includes('text/html')) {
			return null; // PDFs, images, etc. — nothing to extract.
		}

		const chunks: string[] = [];
		let charCount = 0;
		const rewriter = new HTMLRewriter()
			.on('script, style, nav, footer, header, aside', {
				// Drop non-article regions so their text doesn't leak into the summary.
				element(element) {
					element.remove();
				},
			})
			.on(CONTENT_SELECTOR, {
				text(chunk) {
					if (charCount >= MAX_ARTICLE_CHARS) {
						return;
					}
					const text = chunk.text;
					if (text) {
						chunks.push(text);
						charCount += text.length;
					}
				},
			});

		// Drive the rewriter to completion so all text handlers run.
		await rewriter.transform(response).arrayBuffer();

		const text = chunks.join(' ').replace(/\s+/g, ' ').trim();
		return text.slice(0, MAX_ARTICLE_CHARS);
	} catch (error) {
		console.error('Failed to fetch article text:', error);
		return null;
	}
}

/** Normalizes raw model output into at most 3 clean bullet strings. */
function parseBullets(text: string): string[] | null {
	const bullets = text
		.split('\n')
		.map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
		.filter((line) => line.length > 0)
		.slice(0, 3);

	return bullets.length > 0 ? bullets : null;
}
