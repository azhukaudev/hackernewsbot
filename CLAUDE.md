# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A Cloudflare Worker that posts trending Hacker News stories to a Telegram channel. It runs on a cron trigger (every 30 minutes), picks the next eligible top story, summarizes its linked article with Workers AI, and posts it to Telegram. There is no server and no UI — the entire app is the `scheduled()` handler plus a token-gated `fetch()` handler for manual debug runs.

## Commands

Package manager is **pnpm** (Node 25, see `.nvmrc`).

- `pnpm dev` / `pnpm start` — run locally via `wrangler dev`
- `pnpm deploy` — deploy to Cloudflare
- `pnpm test` — run the full vitest suite once
- `pnpm test:watch` — watch mode
- `pnpm exec vitest run test/pipeline.spec.ts` — run a single test file
- `pnpm exec vitest run -t "skips stories already"` — run tests matching a name
- `pnpm cf-typegen` — regenerate `worker-configuration.d.ts` (the `Env` type) after changing bindings in `wrangler.jsonc`
- `pnpm exec tsc --noEmit` / `pnpm exec tsc -p test/tsconfig.json --noEmit` — type-check source / tests (no typecheck script; there is no lint step — Prettier only: 120 cols, tabs, single quotes, semicolons)

## Architecture

The flow is a single linear pipeline, one module per stage, wired together in `src/pipeline.ts` (`publishNextTopStory`):

1. `hacker-news.ts` — fetches top story IDs and individual stories from the HN Firebase API.
2. `posted-store.ts` — `PostedStore`, a KV-backed dedupe set. Each posted story ID is its own self-expiring key (`posted:<id>`, 7-day TTL), so a story is never re-posted while it lingers on the feed.
3. `summarize.ts` — fetches the linked article, extracts body text with `HTMLRewriter`, and asks Workers AI for 2–3 TL;DR bullets. **Best-effort**: every failure path (no URL, paywall/PDF, unreachable page, model error) collapses to `null` so summarization never blocks a post.
4. `format.ts` — renders the Telegram HTML message and chooses the link-preview URL.
5. `telegram.ts` — `TelegramClient.sendMessage` posts to the Bot API.

`config.ts` holds the tuning constants (`MIN_SCORE_TO_POST`, KV key prefix/TTL, HN API base URL). `src/index.ts` is the thin entry point: the `fetch()` handler only gates on `DEBUG_TOKEN` then delegates to the pipeline.

Two invariants worth preserving:

- **Claim-before-send dedupe** (`pipeline.ts`): the story is added to `PostedStore` *before* the slow summarize+send, and removed again if sending throws. This prevents an overlapping/retried cron run from double-posting, while still allowing a retry after a genuine failure.
- **Scan-past-low-scores**: `findNextStoryToPost` skips stories below `MIN_SCORE_TO_POST` rather than stopping, so a low-scoring story near the top doesn't block everything behind it.

### Bindings and config

Modules access bindings via `import { env } from 'cloudflare:workers'` (not a threaded-through `env` param) — follow this pattern in new code. Bindings (`wrangler.jsonc`): `HN_KV` (KV), `AI` (Workers AI). Secrets (set with `wrangler secret put`, mirrored in `.env` / `.env.example` for local dev): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `DEBUG_TOKEN`.

## Testing

Tests run inside the real `workerd` runtime via `@cloudflare/vitest-pool-workers` (config in `vitest.config.mts` — must stay `.mts`, the package is ESM-only). Conventions that are easy to get wrong:

- **Outbound HTTP is mocked by stubbing `globalThis.fetch`** via the `test/fetch-mock.ts` helper — `cloudflare:test` no longer exports `fetchMock`. Unmatched requests throw, which keeps the suite hermetic.
- **Workers AI has no local simulation**, so `remoteBindings: false` is set in the config to avoid a real remote connection (and a 10s teardown hang). Tests stub the binding with `mockAI()` from `test/fixtures.ts`.
- **KV does not reset per-test automatically** — call `reset()` from `cloudflare:test` in `afterEach` for any spec that touches `HN_KV`.
- Handler tests (`index.spec.ts`) `vi.mock('../src/pipeline')` and assert only token-gating/dispatch; the pipeline itself is covered by `pipeline.spec.ts`. When module-mocking, reset call history in `beforeEach` (`mockReset()`) — `afterEach(vi.clearAllMocks)` does not reliably isolate the hoisted mock in this pool.
