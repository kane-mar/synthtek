# Backlog

Code quality backlog (2026-06-26). 29 issues identified by architecture review, 5 fixed, 24 remaining.

## HIGH Severity (6 total, 2 fixed, 4 remaining)

- [x] **H4 — Duplicated media type mapping (Telegram)** — Replaced deeply nested ternary chains with `MEDIA_SEND_METHODS` constant lookup. ✅ FIXED (2026-06-26)
- [x] **H5 — Duplicated provider selection logic** — Added `ProviderManager.getActiveProvider()`. Both ChatService and WebUI server delegate to it. ✅ FIXED (2026-06-26)
- [ ] **H1 — TelegramChannel & DiscordChannel don't extend BaseChannel** — The two most-used channels are standalone classes with no inheritance relationship to `BaseChannel`. They duplicate lifecycle management (state, onMessage, onError, stats tracking) instead of reusing the common base. All other 11 channels extend BaseChannel correctly. **Suggested:** Refactor TelegramChannel and DiscordChannel to extend `BaseChannel<Config, Message>`. Move shared logic (typing indicators, stream buffers, media groups) into the base class or composition helpers. (`src/channels/telegram/channel.ts`, `src/channels/discord/channel.ts`)
- [ ] **H2 — Code duplication between processMessage and processMessageStream** — ~170 lines of nearly identical logic: context management, the main while loop over tool calls, `ensureContextHealthy()`, hooks, tool call execution, and result building. The only difference is LLM call strategy (non-streaming vs streaming). `createStreamingStrategy()` was extracted for the retry logic but the full loop remains duplicated. **Suggested:** Extract shared loop logic into a private method, parameterizing LLM call strategy. (`src/agent/loop.ts`)
- [ ] **H3 — Telegram sendFile passes Buffer in JSON body — won't work** — `sendFile()` passes `Buffer` directly in JSON body. Telegram's Bot API requires multipart/form-data for file uploads. The comment says "In production, use FormData" but this is production code. **Suggested:** Implement proper `FormData`-based upload using Node.js `Blob`/`File`. Update `apiCall` to support FormData bodies. (`src/channels/telegram/channel.ts`)
- [ ] **H6 — DiscordChannel and TelegramChannel use `any` extensively** — Discord `parseMessage(msg: any)`, `interactionCreate` handler, intent mapping casts to `any`. Telegram `parseMessage(update: any)`, `apiCallWithRetry` catches `error: any`. Both have pervasive `as any` casts for message sending, thread operations, permissions, and other platform-specific operations. **Suggested:** Replace `any` with proper interfaces or union types for the specific shapes used. (`src/channels/discord/channel.ts`, `src/channels/telegram/channel.ts`)

## MEDIUM Severity (9 total, 0 fixed, 9 remaining)

- [ ] **M1 — Circuit breaker emits `half_open` on every check (not just transitions)** — `loop.ts` L175–182: The circuit breaker's `check()` method emits `"half_open"` every time it's called while in `half_open` state, not just on the transition from `open` → `half_open`. This causes redundant events and can trigger duplicate recovery attempts. **Suggested:** Track whether the state actually changed and only emit on transition.
- [ ] **M2 — Telegram.start() and its caller in runner.ts are not awaited** — `src/channels/telegram/channel.ts` start sequence uses promises that are never awaited by the runner. Multiple Telegram methods return promises that are silently discarded, leading to lost errors and race conditions during startup/shutdown. **Suggested:** Ensure all channel startup promises are properly awaited in `AgentRunner.startConfiguredChannels()`.
- [ ] **M3 — Provider metadata object constructed identically in two places** — `src/agent/runner.ts` L174–206: The `providerManagerLike` object is constructed in `createChatService()` with the same provider metadata in both `list()` and `find()`. This duplicates the provider shape definition. **Suggested:** Extract a helper method or store the provider config once and reference it.
- [ ] **M4 — 12 stub channel methods with identical "pending implementation" pattern** — `src/agent/runner.ts` L476–564: 12 channel start methods (WeChat, WeCom, Feishu, Matrix, QQ, DingTalk, Email, Teams, WhatsApp, WebSocket) are stubs that only log "configured (start pending implementation)". None are actually wired to ChatService yet. **Suggested:** Wire each stub to its actual channel implementation, following the Telegram/Discord pattern of creating the channel instance and connecting onMessage through ChatService.
- [ ] **M5 — Media group buffer timeout only deletes buffer, doesn't actually send** — `src/channels/telegram/channel.ts`: When the media group buffer timeout fires, it only deletes the buffer entry. The buffered media items are never actually sent as a group. **Suggested:** Implement actual media group sending via `sendMediaGroup` API when the timeout fires.
- [ ] **M6 — Runtime type check for `ProviderManagerLike.find()` existence** — `src/messaging/chat-service.ts` L140–144: Checks `if (this.providerManager.find)` at runtime to decide which path to use. This is a code smell — the type system should guarantee the method exists. **Suggested:** Make `find()` required in the interface, or always use `getActiveProvider()`.
- [ ] **M7 — Verbose per-property config assignment in Discord** — `src/channels/discord/channel.ts` L179–198: The `DiscordChannel` constructor assigns each config property individually with fallback defaults. This is verbose and error-prone. **Suggested:** Use object spread with defaults: `this.config = { ...defaultConfig, ...config }`.
- [ ] **M8 — Module-level `chunkCounter` is shared across all `StreamOptimizer` instances** — `src/performance/streaming.ts` L15: A module-level `let chunkCounter = 0` means all StreamOptimizer instances share the same counter, causing incorrect chunk identification and stats. **Suggested:** Make `chunkCounter` an instance property.
- [ ] **M9 — Misplaced eslint-disable comment** — `src/performance/streaming.ts` L30–33: An eslint-disable comment for `@typescript-eslint/no-unused-vars` is placed before the constructor, suppressing warnings for a genuinely unused parameter rather than fixing the signature. **Suggested:** Prefix the unused parameter with `_` instead of suppressing the lint rule.

## LOW Severity (14 total, 3 fixed, 11 remaining)

- [x] **L10 — parseToolCalls regex callback uses `as any` cast** — Removed `as any` from markdown formatting callbacks by typing parameters as `(match: string, code: string)`. ✅ FIXED (2026-06-26)
- [x] **L13 — Runner.ts processMessage uses `(provider as any).getConfig`** — Removed `as any`. LLMProvider interface already includes `getConfig()`. ✅ FIXED (2026-06-26)
- [ ] **L1 — Stub `chatStream` in fallback provider** — `src/providers/fallback.ts` L35: `MultiProvider.chatStream()` returns `null` as a mock implementation, preventing streaming for fallback configurations. **Suggested:** Implement actual multi-provider streaming with failover, or throw a clear error.
- [ ] **L2 — Telegram-coupled CLI processing in runner.ts** — `src/agent/runner.ts` L583–619: `processMessage()` and `processMessageStream()` have Telegram-specific `sendTyping()` and `sendMessage()` calls hardcoded, making them unusable for other channels. **Suggested:** Make the response channel configurable or inject a response callback.
- [ ] **L3 — Misleading underscore prefix on used parameter** — `src/agent/runner.ts`: Several parameters are prefixed with `_` (suggesting unused) but are actually used in the body. This misleads readers and linters. **Suggested:** Remove the underscore prefix from parameters that are actually used.
- [ ] **L4 — Leaking typing timeout across multiple chat targets** — `src/channels/telegram/channel.ts`: The `TypingTimeout` entries are stored by `chatId`, but when a single Telegram bot handles multiple conversations, a previous chat's timeout can stop a new chat's typing indicator prematurely. **Suggested:** Use a unique key or proper TTL per chat.
- [ ] **L5 — Inlined frontend HTML as a giant template string** — `src/webui/frontend/index.ts`: The entire frontend (HTML, CSS, JS) is embedded as a massive template literal string in `buildFrontend()`. This makes it impossible to syntax-highlight, lint, test, or version-control the frontend code separately. **Suggested:** Extract HTML, CSS, and JS into separate files and bundle them at build time.
- [ ] **L6 — Only POST method used for all API calls** — `src/channels/telegram/channel.ts`: All Telegram API calls use HTTP POST even when the method only needs GET (e.g., `getMe`, `getUpdates`). **Suggested:** Use the appropriate HTTP method for each endpoint.
- [ ] **L7 — Inconsistent comment styles across channels** — Telegram uses `#region` style comments (`// ─── Send Methods ───`), Discord uses `// ──` style, while other channels use standard block comments. **Suggested:** Standardize on a single comment convention.
- [ ] **L8 — ChannelStats interface allows arbitrary keys** — `src/channels/base-channel.ts` L44: `[key: string]: unknown` in the `ChannelStats` interface defeats type safety. Subclasses can add platform-specific stats but lose compile-time checking. **Suggested:** Use a generic type parameter or a discriminated union for platform-specific stats.
- [ ] **L9 — Redundant Discord intent mapping** — `src/channels/discord/channel.ts`: Discord intents are mapped through an object lookup that falls back to `GatewayIntentBits.Guilds` for unknown values. **Suggested:** Pass intents directly without the mapping layer.
- [ ] **L11 — FallbackProvider getConfig returns empty apiKey** — `src/providers/fallback.ts` L41–46: `getConfig()` returns hard-coded values that don't reflect child provider configurations. **Suggested:** Return aggregated config or throw clear error.
- [ ] **L12 — StreamOptimizer.compressionEnabled is a getter for static config flag** — `src/performance/streaming.ts` L90–92: The `stats()` method simulates compression by returning `Math.floor(this._totalBytes * 0.7)` — no actual compression is performed. **Suggested:** Either implement actual compression or remove the fake stats.
- [ ] **L14 — MemoryListener/event system inconsistency in loop.ts** — `src/agent/loop.ts` L867–877: The `on()`/`off()`/`once()` methods wrap a Node.js `EventEmitter` with `(...args: unknown[]) => void`, losing all type safety. **Suggested:** Define a typed event map interface.

## Summary

| Severity | Total | Fixed | Remaining |
|----------|-------|-------|-----------|
| HIGH     | 6     | 2     | 4         |
| MEDIUM   | 9     | 0     | 9         |
| LOW      | 14    | 3     | 11        |
| **Total**| **29**| **5** | **24**    |

---

*Started: 2026-06-26. Working one item at a time using TDD + clean code.*
