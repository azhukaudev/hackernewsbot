/** Minimal Telegram Bot API client for posting story messages to a chat. */
export class TelegramClient {
	constructor(
		private readonly botToken: string,
		private readonly chatId: string,
	) {}

	async sendMessage(html: string, previewUrl: string): Promise<void> {
		const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				chat_id: this.chatId,
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
