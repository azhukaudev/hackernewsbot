const HN_API_BASE_URL = 'https://hacker-news.firebaseio.com/v0';
const MIN_SCORE_TO_POST = 100;
// Each posted story is tracked as its own KV key that self-expires, so we never
// re-post a story while it lingers on the top feed. HN ids only increase, so a
// week is well beyond how long any story stays on the list.
const POSTED_KEY_PREFIX = 'posted:';
const POSTED_TTL_SECONDS = 60 * 60 * 24 * 7;

interface HNStory {
	id: number;
	title: string;
	url?: string;
	descendants?: number;
	score: number;
}

export default {
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		ctx.waitUntil(publishNextTopStory(env));
	},

	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const requestUrl = new URL(request.url);
		const token = requestUrl.searchParams.get('token');

		if (token !== env.DEBUG_TOKEN) {
			return new Response('Unauthorized', { status: 401 });
		}

		await publishNextTopStory(env);
		return new Response('Pipeline executed successfully.', { status: 200 });
	},
};

async function publishNextTopStory(env: Env): Promise<void> {
	const topStoryIds = await fetchTopStoryIds();

	// Post the first unposted story that clears the score threshold, scanning
	// past lower-scored ones near the top so they don't block the rest.
	let story: HNStory | null = null;
	for (const storyId of topStoryIds) {
		if (await hasBeenPosted(env, storyId)) {
			continue;
		}

		const candidate = await fetchStoryById(storyId);
		if (!candidate) {
			continue;
		}

		if (candidate.score < MIN_SCORE_TO_POST) {
			console.log(
				`Skipping: "${candidate.title}" only has ${candidate.score} points. Waiting for it to cross ${MIN_SCORE_TO_POST}.`,
			);
			continue;
		}

		story = candidate;
		break;
	}

	if (!story) {
		console.log('No new stories found in the current top feed.');
		return;
	}

	const discussionUrl = `https://news.ycombinator.com/item?id=${story.id}`;
	// Ask HN / Show HN text posts and job posts have no `url` — fall back to the HN discussion link.
	const previewUrl = story.url ?? discussionUrl;

	const commentCount = story.descendants ?? 0;
	const stats = [
		`🚀 ${story.score} ${plural(story.score, 'point')}`,
		`💬 ${commentCount} ${plural(commentCount, 'comment')}`,
	];

	let messageHtml = `<b>${escapeHtml(story.title)}</b>\n\n`;
	messageHtml += `${stats.join(' · ')}\n\n`;
	if (story.url) {
		messageHtml += `📖 <b>Read:</b> <a href="${story.url}">${escapeHtml(extractDomain(story.url))}</a>\n`;
	}
	messageHtml += `💬 <b>Discussion:</b> <a href="${discussionUrl}">news.ycombinator.com</a>`;

	const sendMessageUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
	const telegramResponse = await fetch(sendMessageUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			chat_id: env.TELEGRAM_CHAT_ID,
			text: messageHtml,
			parse_mode: 'HTML',
			link_preview_options: {
				is_disabled: false,
				url: previewUrl,
				prefer_large_media: true,
			},
		}),
	});

	if (!telegramResponse.ok) {
		const errorBody = await telegramResponse.text();
		throw new Error(`Telegram API returned status ${telegramResponse.status}: ${errorBody}`);
	}

	await markAsPosted(env, story.id);

	console.log(`Successfully posted new story: "${story.title}"`);
}

async function fetchTopStoryIds(): Promise<number[]> {
	try {
		const response = await fetch(`${HN_API_BASE_URL}/topstories.json`);
		if (!response.ok) {
			throw new Error('Network response was not ok');
		}
		return await response.json<number[]>();
	} catch (error) {
		console.error('Failed to fetch or parse story ids:', error);
		return [];
	}
}

async function hasBeenPosted(env: Env, storyId: number): Promise<boolean> {
	const marker = await env.HN_KV.get(`${POSTED_KEY_PREFIX}${storyId}`);
	return marker !== null;
}

async function markAsPosted(env: Env, storyId: number): Promise<void> {
	await env.HN_KV.put(`${POSTED_KEY_PREFIX}${storyId}`, '1', {
		expirationTtl: POSTED_TTL_SECONDS,
	});
}

async function fetchStoryById(id: number): Promise<HNStory | null> {
	try {
		const response = await fetch(`${HN_API_BASE_URL}/item/${id}.json`);
		if (!response.ok) {
			throw new Error('Network response was not ok');
		}
		return await response.json<HNStory>();
	} catch (error) {
		console.error('Failed to fetch or parse story:', error);
		return null;
	}
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
