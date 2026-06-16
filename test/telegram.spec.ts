import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TelegramClient } from '../src/telegram';
import { mockFetch, urlContains } from './fetch-mock';

afterEach(() => vi.unstubAllGlobals());

describe('TelegramClient.sendMessage', () => {
	it('POSTs an HTML message with link preview options to the bot endpoint', async () => {
		const fetchSpy = mockFetch([{ match: urlContains('api.telegram.org'), respond: { status: 200, body: 'ok' } }]);

		await new TelegramClient().sendMessage('<b>Hello</b>', 'https://example.com/article');

		expect(fetchSpy).toHaveBeenCalledOnce();
		const [url, init] = fetchSpy.mock.calls[0];
		expect(url).toContain(`/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`);
		expect(init?.method).toBe('POST');

		const payload = JSON.parse(init?.body as string);
		expect(payload).toMatchObject({
			chat_id: env.TELEGRAM_CHAT_ID,
			text: '<b>Hello</b>',
			parse_mode: 'HTML',
			link_preview_options: {
				is_disabled: false,
				url: 'https://example.com/article',
				prefer_large_media: true,
			},
		});
	});

	it('throws when the Telegram API responds with a non-2xx status', async () => {
		mockFetch([{ match: urlContains('api.telegram.org'), respond: { status: 400, body: 'Bad Request: chat not found' } }]);

		await expect(new TelegramClient().sendMessage('<b>Hi</b>', 'https://example.com')).rejects.toThrow(/status 400/);
	});
});
