import { HN_API_BASE_URL } from './config';

export interface HNStory {
	id: number;
	title: string;
	url?: string;
	score: number;
}

/** Discussion page for a story on Hacker News. */
export function discussionUrl(storyId: number): string {
	return `https://news.ycombinator.com/item?id=${storyId}`;
}

export async function fetchTopStoryIds(): Promise<number[]> {
	try {
		const response = await fetch(`${HN_API_BASE_URL}/topstories.json`);
		if (!response.ok) {
			throw new Error(`HN top stories request failed with status ${response.status}`);
		}
		return await response.json<number[]>();
	} catch (error) {
		console.error('Failed to fetch or parse story ids:', error);
		return [];
	}
}

export async function fetchStoryById(id: number): Promise<HNStory | null> {
	try {
		const response = await fetch(`${HN_API_BASE_URL}/item/${id}.json`);
		if (!response.ok) {
			throw new Error(`HN story request failed with status ${response.status}`);
		}
		return await response.json<HNStory>();
	} catch (error) {
		console.error('Failed to fetch or parse story:', error);
		return null;
	}
}
