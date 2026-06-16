import { env } from 'cloudflare:workers';
import { createExecutionContext, createScheduledController, waitOnExecutionContext } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import worker from '../src';
import { publishNextTopStory } from '../src/pipeline';

// The handlers' only job is to gate on the token and delegate to the pipeline;
// the pipeline itself is covered by pipeline.spec.ts, so mock it out here.
vi.mock('../src/pipeline', () => ({ publishNextTopStory: vi.fn() }));
const publish = vi.mocked(publishNextTopStory);

beforeEach(() => {
	publish.mockReset();
	publish.mockResolvedValue(undefined);
});

describe('fetch handler', () => {
	it('returns 401 and skips the pipeline when the token is wrong', async () => {
		const ctx = createExecutionContext();
		const response = await worker.fetch(new Request('http://example.com/?token=wrong'), env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(401);
		expect(publish).not.toHaveBeenCalled();
	});

	it('runs the pipeline and returns 200 when the token matches', async () => {
		const ctx = createExecutionContext();
		const response = await worker.fetch(new Request(`http://example.com/?token=${env.DEBUG_TOKEN}`), env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(publish).toHaveBeenCalledOnce();
	});
});

describe('scheduled handler', () => {
	it('drives the publish pipeline', async () => {
		const ctx = createExecutionContext();
		// The handler types its event as the legacy `ScheduledEvent`; the test
		// controller is the runtime-accurate shape, so bridge the two here.
		await worker.scheduled(createScheduledController() as unknown as ScheduledEvent, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(publish).toHaveBeenCalledOnce();
	});
});
