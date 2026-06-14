const HN_API_BASE_URL = 'https://hacker-news.firebaseio.com/v0';
const MIN_SCORE_TO_POST = 100;
const MAX_POSTED_IDS_RETAINED = 2000;
const POSTED_IDS_KV_KEY = 'POSTED_STORY_IDS';

interface HNStory {
	id: number;
	title: string;
	url?: string;
	descendants: number;
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
	const postedStoryIds = await fetchPostedStoryIds(env);
	const postedStoryIdSet = new Set(postedStoryIds);

	let nextStoryId: number | null = null;
	for (const storyId of topStoryIds) {
		if (!postedStoryIdSet.has(storyId)) {
			nextStoryId = storyId;
			break;
		}
	}

	if (nextStoryId === null) {
		console.log('No new stories found in the current top feed.');
		return;
	}

	const story = await fetchStoryById(nextStoryId);
	if (!story) {
		console.log('No story found for a provided id');
		return;
	}

	if (story.score < MIN_SCORE_TO_POST) {
		console.log(
			`Skipping: "${story.title}" only has ${story.score} points. Waiting for it to cross ${MIN_SCORE_TO_POST}.`,
		);
		return;
	}

	const discussionUrl = `https://news.ycombinator.com/item?id=${story.id}`;
	// Ask HN / Show HN text posts and job posts have no `url` — fall back to the HN discussion link.
	const previewUrl = story.url ?? discussionUrl;

	let messageHtml = `<b>${escapeHtml(story.title)}</b>\n\n`;
	if (story.url) {
		messageHtml += `<b>Read:</b> <a href="${previewUrl}">${previewUrl}</a>\n`;
	}
	messageHtml += `<b>Discussion:</b> <a href="${discussionUrl}">${discussionUrl}</a>`;

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

	postedStoryIds.push(nextStoryId);
	if (postedStoryIds.length > MAX_POSTED_IDS_RETAINED) {
		postedStoryIds.shift();
	}
	await env.HN_KV.put(POSTED_IDS_KV_KEY, JSON.stringify(postedStoryIds));

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

async function fetchPostedStoryIds(env: Env): Promise<number[]> {
	const postedStoryIds = await env.HN_KV.get<number[]>(POSTED_IDS_KV_KEY);
	if (!postedStoryIds) {
		return [];
	}
	return postedStoryIds;
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
