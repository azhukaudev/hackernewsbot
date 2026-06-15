import { discussionUrl, HNStory } from './hacker-news';

/** Renders a story as the HTML message body sent to Telegram. */
export function formatStoryMessage(story: HNStory, summary?: string[] | null): string {
	const commentCount = story.descendants ?? 0;
	const stats = [
		`🚀 ${story.score} ${plural(story.score, 'point')}`,
		`💬 ${commentCount} ${plural(commentCount, 'comment')}`,
	];

	const lines = [`<b>${escapeHtml(story.title)}</b>`, '', stats.join(' · '), ''];

	if (summary && summary.length > 0) {
		for (const bullet of summary) {
			lines.push(`- ${escapeHtml(bullet)}`);
		}
		lines.push('');
	}

	if (story.url) {
		lines.push(`📖 <b>Read:</b> <a href="${story.url}">${escapeHtml(extractDomain(story.url))}</a>`);
	}
	lines.push(`💬 <b>Discussion:</b> <a href="${discussionUrl(story.id)}">news.ycombinator.com</a>`);

	return lines.join('\n');
}

/** The link Telegram should render a preview for. */
export function storyPreviewUrl(story: HNStory): string {
	// Ask HN / Show HN text posts and job posts have no `url` — fall back to the HN discussion link.
	return story.url ?? discussionUrl(story.id);
}

function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function plural(count: number, noun: string): string {
	return count === 1 ? noun : `${noun}s`;
}

function extractDomain(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return url;
	}
}
