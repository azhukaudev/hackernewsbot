export const HN_API_BASE_URL = 'https://hacker-news.firebaseio.com/v0';

/** Minimum HN score a story must reach before it's worth posting. */
export const MIN_SCORE_TO_POST = 100;

/**
 * Each posted story is tracked as its own KV key that self-expires, so we never
 * re-post a story while it lingers on the top feed. HN ids only increase, so a
 * week is well beyond how long any story stays on the list.
 */
export const POSTED_KEY_PREFIX = 'posted:';
export const POSTED_TTL_SECONDS = 60 * 60 * 24 * 7;
