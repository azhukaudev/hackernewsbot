import { env } from 'cloudflare:workers';

import { MIN_SCORE_TO_POST } from './config';
import { formatStoryMessage, storyPreviewUrl } from './format';
import { fetchStoryById, fetchTopStoryIds, HNStory } from './hacker-news';
import { PostedStore } from './posted-store';
import { summarizeStory } from './summarize';
import { TelegramClient } from './telegram';

/** Posts the next eligible top HN story to Telegram, if there is one. */
export async function publishNextTopStory(): Promise<void> {
	const posted = new PostedStore(env.HN_KV);

	const story = await findNextStoryToPost(posted);
	if (!story) {
		console.log('No new stories found in the current top feed.');
		return;
	}

	// Claim the story before the slow summarize + send, so an overlapping or
	// retried cron run can't pick the same story and post it twice.
	await posted.add(story.id);

	try {
		const summary = await summarizeStory(story);
		const telegram = new TelegramClient();
		await telegram.sendMessage(formatStoryMessage(story, summary), storyPreviewUrl(story));
	} catch (error) {
		await posted.remove(story.id); // Release the claim so a later run retries.
		throw error;
	}

	console.log(`Successfully posted new story: "${story.title}"`);
}

/**
 * Returns the first unposted story that clears the score threshold, scanning
 * past lower-scored ones near the top so they don't block the rest.
 */
async function findNextStoryToPost(posted: PostedStore): Promise<HNStory | null> {
	const topStoryIds = await fetchTopStoryIds();

	for (const storyId of topStoryIds) {
		if (await posted.has(storyId)) {
			continue;
		}

		const story = await fetchStoryById(storyId);
		if (!story) {
			continue;
		}

		if (story.score < MIN_SCORE_TO_POST) {
			console.log(
				`Skipping: "${story.title}" only has ${story.score} points. Waiting for it to cross ${MIN_SCORE_TO_POST}.`,
			);
			continue;
		}

		return story;
	}

	return null;
}
