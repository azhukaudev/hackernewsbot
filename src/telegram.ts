import { env } from 'cloudflare:workers';

/** Minimal Telegram Bot API client for posting story messages to a chat. */
export class TelegramClient {
	async sendMessage(html: string, previewUrl: string): Promise<void> {
		const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				chat_id: env.TELEGRAM_CHAT_ID,
				text: html,
				parse_mode: 'HTML',
				link_preview_options: {
					is_disabled: false,
					url: previewUrl,
					prefer_large_media: true,
				},
			}),
		});

		if (!response.ok) {
			const errorBody = await response.text();
			throw new Error(`Telegram API returned status ${response.status}: ${errorBody}`);
		}
	}
}
