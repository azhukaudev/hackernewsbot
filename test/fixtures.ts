import { env } from 'cloudflare:workers';
import { vi } from 'vitest';

/** An HTML page whose extracted body comfortably clears MIN_ARTICLE_CHARS (200). */
export const ARTICLE_HTML = `<html><body><article><p>${'a real sentence with content. '.repeat(30)}</p></article></body></html>`;

/**
 * Stubs the Workers AI binding with a canned response. Workers AI has no local
 * simulation, so `env.AI.run` is always replaced in tests. Centralizes the cast
 * needed to satisfy the binding's overloaded return type.
 */
export function mockAI(response: string) {
	return vi.spyOn(env.AI, 'run').mockResolvedValue({ response } as never);
}
