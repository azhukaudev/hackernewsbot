import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: './wrangler.jsonc' },
			// Workers AI has no local simulation, so the AI binding otherwise opens a
			// remote proxy session at startup (needs network + credentials, and leaks
			// past teardown). Tests stub `env.AI` at runtime, so keep the suite
			// hermetic by never starting that session.
			remoteBindings: false,
			miniflare: {
				// Secrets aren't in wrangler.jsonc; provide test values so env reads work.
				bindings: {
					TELEGRAM_BOT_TOKEN: 'test-bot-token',
					TELEGRAM_CHAT_ID: 'test-chat-id',
					DEBUG_TOKEN: 'test-debug-token',
				},
			},
		}),
	],
});
