# Backlog

Code quality backlog (2026-06-26). 29 issues identified by architecture review, 22 fixed, 7 remaining.

## HIGH Severity (6 total, 4 fixed, 2 remaining)

- [x] **H4 — Duplicated media type mapping (Telegram)** — Replaced deeply nested ternary chains with `MEDIA_SEND_METHODS` constant lookup. ✅ FIXED (2026-06-26)
- [x] **H5 — Duplicated provider selection logic** — Added `ProviderManager.getActiveProvider()`. Both ChatService and WebUI server delegate to it. ✅ FIXED (2026-06-26)
- [x] **H3 — Telegram sendFile passes Buffer in JSON body** — Implemented proper `FormData`-based upload using Node.js `Blob`/`File`. Buffer uploads now use multipart/form-data. ✅ FIXED (2026-06-26)
- [x] **H2 — ProcessMessage/processMessageStream duplication** — Extracted `createStreamingStrategy()` with retry/circuit-breaker logic. Streaming strategy shared between both paths. Core loop logic (`executeAgentLoop`) shared for non-streaming. ✅ FIXED (2026-06-26)
- [ ] **H1 — TelegramChannel & DiscordChannel don't extend BaseChannel** — The two most-used channels are standalone classes with no inheritance relationship to `BaseChannel`. They duplicate lifecycle management (state, onMessage, onError, stats tracking) instead of reusing the common base. All other 11 channels extend BaseChannel correctly. This is a large refactor requiring careful testing. (`src/channels/telegram/channel.ts`, `src/channels/discord/channel.ts`)
- [ ] **H6 — DiscordChannel and TelegramChannel use `any` extensively** — Both channels have `as any` casts for third-party library operations. Some are unavoidable (external API types), but many have been fixed. Remaining casts are in library-interop code where full type definitions would require discord.js/Telegram API type packages. (`src/channels/discord/channel.ts`, `src/channels/telegram/channel.ts`)

## MEDIUM Severity (9 total, 9 fixed, 0 remaining)

- [x] **M1 — Circuit breaker emits `half_open` on every check (not just transitions)** — Simplified `isCircuitBreakerOpen()` to delegate to `errorHandler.isCircuitOpen()` which already handles transitions correctly. ✅ FIXED (2026-06-26)
- [x] **M2 — Telegram.start() and its caller in runner.ts are not awaited** — Added `await` to `this.telegram.start()` call in `startTelegram()`. Properly awaits the channel connection. ✅ FIXED (2026-06-26)
- [x] **M3 — Provider metadata object constructed identically in two places** — Extracted `buildProviderMeta()` helper function, used in both `list()` and `find()`. ✅ FIXED (2026-06-26)
- [x] **M4 — 12 stub channel methods with identical "pending implementation" pattern** — All 12 channel start methods now create actual channel instances, wire message handlers through `ChatService`, connect, and register for lifecycle management via `activeChannels` set. Uses a shared `wireBaseChannel()` helper for BaseChannel-extending channels. ✅ FIXED (2026-06-26)
- [x] **M5 — Media group buffer timeout only deletes buffer** — Timeout handler now sends the buffered media items via `sendMediaGroup` API before deleting the buffer. ✅ FIXED (2026-06-26)
- [x] **M6 — Runtime type check for `ProviderManagerLike.find()` existence** — Made `getActiveProvider()` required in the `ProviderManagerLike` interface. Removed the fallback path in `ChatService.sendMessage()`. ✅ FIXED (2026-06-26)
- [x] **M7 — Verbose per-property config assignment in Discord** — Replaced 15+ individual `??` fallback assignments with single `...defaultConfig` spread. ✅ FIXED (2026-06-26)
- [x] **M8 — Module-level `chunkCounter` is shared across all `StreamOptimizer` instances** — Changed `chunkCounter` from module-level to instance property `this._chunkCounter`. ✅ FIXED (2026-06-26)
- [x] **M9 — Misplaced eslint-disable comment** — Replaced `eslint-disable` with `getFlushTimer()` method that provides same accessor functionality without suppressing lint rules. ✅ FIXED (2026-06-26)

## LOW Severity (14 total, 9 fixed, 5 remaining)

- [x] **L10 — parseToolCalls regex callback uses `as any` cast** — Removed `as any` from markdown formatting callbacks by typing parameters. ✅ FIXED (2026-06-26)
- [x] **L13 — Runner.ts processMessage uses `(provider as any).getConfig`** — Removed `as any`. LLMProvider interface already includes `getConfig()`. ✅ FIXED (2026-06-26)
- [x] **L1 — Stub `chatStream` in fallback provider** — `chatStream()` already implements multi-provider streaming with failover. Verified implementation exists. ✅ FIXED (already implemented)
- [x] **L11 — FallbackProvider getConfig returns empty apiKey** — `getConfig()` now returns the first child provider's config as representative. ✅ FIXED (2026-06-26)
- [x] **L12 — StreamOptimizer.compressionEnabled is a getter for static config flag** — Removed fake compression stats (`Math.floor(this._totalBytes * 0.7)`). `stats()` now returns `compressedBytes: 0`. ✅ FIXED (2026-06-26)
- [x] **L14 — Event system inconsistency in loop.ts** — Added documented event map with all events and their payload shapes. ✅ FIXED (2026-06-26)
- [x] **L2 — Telegram-coupled CLI processing in runner.ts** — Both `processMessage()` and `processMessageStream()` now route through `ChatService` instead of directly calling `AgentLoop` with Telegram-specific code. ✅ FIXED (2026-06-26)
- [x] **L4 — Leaking typing timeout across multiple chat targets** — Changed `typingTimeout` from a single instance variable to `Map<chatId, timeout>`. Each chat now has its own timeout, preventing cross-chat interference. ✅ FIXED (2026-06-26)
- [x] **L6 — Only POST method used for all API calls** — Added `GET_METHODS` set. Read-only Telegram API calls (`getMe`, `getUpdates`, `getFile`, etc.) now use GET instead of POST. ✅ FIXED (2026-06-26)
- [ ] **L3 — Misleading underscore prefix on used parameter** — `_channelName` and `_systemPrompt` in runner.ts are genuinely unused parameters. Underscore prefix is correct for unused parameters. No fix needed.
- [ ] **L5 — Inlined frontend HTML as a giant template string** — The entire frontend is embedded as a massive template literal. Requires extracting HTML/CSS/JS into separate files and bundling at build time. This is a larger architectural task.
- [ ] **L7 — Inconsistent comment styles across channels** — Partially fixed (Telegram now uses double-dash `// ── Section ──` style). Other channels use varying styles.
- [ ] **L8 — ChannelStats interface allows arbitrary keys** — Changed `[key: string]: unknown` to `platform?: TAdditional` generic type. ✅ FIXED (2026-06-26)
- [ ] **L9 — Redundant Discord intent mapping** — Improved with warning for unknown intents and cleaner spread-based defaults. ✅ FIXED (2026-06-26)

## Summary

| Severity | Total | Fixed | Remaining |
|----------|-------|-------|-----------|
| HIGH     | 6     | 4     | 2         |
| MEDIUM   | 9     | 9     | 0         |
| LOW      | 14    | 9     | 5         |
| **Total**| **29**| **22** | **7**    |

### Remaining items

1. **H1** — Refactor Telegram/Discord to extend BaseChannel (massive — highest impact remaining)
2. **H6** — Remaining `any` types in library-interop code (some unavoidable without third-party type packages)
3. **L3** — No fix needed (underscore prefixes are correct for unused params)
4. **L5** — Extract frontend HTML/CSS/JS into separate files (architectural)
5. **L7** — Standardize comment conventions across all channels (cosmetic)

---

*Started: 2026-06-26. Working one item at a time using TDD + clean code.*
