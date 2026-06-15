import { publishNextTopStory } from './pipeline';

export default {
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		ctx.waitUntil(publishNextTopStory());
	},

	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const token = new URL(request.url).searchParams.get('token');
		if (token !== env.DEBUG_TOKEN) {
			return new Response('Unauthorized', { status: 401 });
		}

		await publishNextTopStory();
		return new Response('Pipeline executed successfully.', { status: 200 });
	},
};
