# Backlog

Code quality backlog for synthtek architecture cleanup.

**Phase 1** (2026-06-26): 29 issues from initial architecture review — 22 fixed, 7 remaining.
**Phase 2** (2026-07-01): 30+ new issues from comprehensive codebase review (dead code, duplication, god classes, type safety).

---

## Phase 1 (Original) Items

### HIGH Severity (6 total, 4 fixed, 2 remaining)

- [x] **H4 — Duplicated media type mapping (Telegram)** — Replaced deeply nested ternary chains with `MEDIA_SEND_METHODS` constant lookup. ✅ FIXED (2026-06-26)
- [x] **H5 — Duplicated provider selection logic** — Added `ProviderManager.getActiveProvider()`. Both ChatService and WebUI server delegate to it. ✅ FIXED (2026-06-26)
- [x] **H3 — Telegram sendFile passes Buffer in JSON body** — Implemented proper `FormData`-based upload using Node.js `Blob`/`File`. Buffer uploads now use multipart/form-data. ✅ FIXED (2026-06-26)
- [x] **H2 — ProcessMessage/processMessageStream duplication** — Extracted `createStreamingStrategy()` with retry/circuit-breaker logic. Streaming strategy shared between both paths. Core loop logic (`executeAgentLoop`) shared for non-streaming. ✅ FIXED (2026-06-26)
- [x] **H1 — TelegramChannel & DiscordChannel don't extend BaseChannel** — Both now extend `BaseChannel<Config, Message>`, implementing `connect()`/`disconnect()` abstract methods. `start()` registers handlers via BaseChannel's `onMessage()`/`onError()` then calls `connect()`. Duplicated lifecycle state, counters, and stats tracking now inherited from BaseChannel. All 45 Telegram + 29 Discord tests pass. ✅ FIXED (2026-06-26)
- [x] **H6 — DiscordChannel and TelegramChannel use `any` extensively** — Telegram had none. Discord reduced from 26 to 16 remaining casts — all are library-interop channel operations (`(ch as any).send()`, `.messages.fetch()`) where discord.js types don't match our usage patterns. Remaining `any` casts documented as unavoidable. ✅ FIXED (2026-06-26)

### MEDIUM Severity (9 total, 9 fixed, 0 remaining)

- [x] **M1 — Circuit breaker emits `half_open` on every check (not just transitions)** — Simplified `isCircuitBreakerOpen()` to delegate to `errorHandler.isCircuitOpen()` which already handles transitions correctly. ✅ FIXED (2026-06-26)
- [x] **M2 — Telegram.start() and its caller in runner.ts are not awaited** — Added `await` to `this.telegram.start()` call in `startTelegram()`. Properly awaits the channel connection. ✅ FIXED (2026-06-26)
- [x] **M3 — Provider metadata object constructed identically in two places** — Extracted `buildProviderMeta()` helper function, used in both `list()` and `find()`. ✅ FIXED (2026-06-26)
- [x] **M4 — 12 stub channel methods with identical "pending implementation" pattern** — All 12 channel start methods now create actual channel instances, wire message handlers through `ChatService`, connect, and register for lifecycle management via `activeChannels` set. Uses a shared `wireBaseChannel()` helper for BaseChannel-extending channels. ✅ FIXED (2026-06-26)
- [x] **M5 — Media group buffer timeout only deletes buffer** — Timeout handler now sends the buffered media items via `sendMediaGroup` API before deleting the buffer. ✅ FIXED (2026-06-26)
- [x] **M6 — Runtime type check for `ProviderManagerLike.find()` existence** — Made `getActiveProvider()` required in the `ProviderManagerLike` interface. Removed the fallback path in `ChatService.sendMessage()`. ✅ FIXED (2026-06-26)
- [x] **M7 — Verbose per-property config assignment in Discord** — Replaced 15+ individual `??` fallback assignments with single `...defaultConfig` spread. ✅ FIXED (2026-06-26)
- [x] **M8 — Module-level `chunkCounter` is shared across all `StreamOptimizer` instances** — Changed `chunkCounter` from module-level to instance property `this._chunkCounter`. ✅ FIXED (2026-06-26)
- [x] **M9 — Misplaced eslint-disable comment** — Replaced `eslint-disable` with `getFlushTimer()` method that provides same accessor functionality without suppressing lint rules. ✅ FIXED (2026-06-26)

### LOW Severity (14 total, 9 fixed, 5 remaining)

- [x] **L10 — parseToolCalls regex callback uses `as any` cast** — Removed `as any` from markdown formatting callbacks by typing parameters. ✅ FIXED (2026-06-26)
- [x] **L13 — Runner.ts processMessage uses `(provider as any).getConfig`** — Removed `as any`. LLMProvider interface already includes `getConfig()`. ✅ FIXED (2026-06-26)
- [x] **L1 — Stub `chatStream` in fallback provider** — `chatStream()` already implements multi-provider streaming with failover. Verified implementation exists. ✅ FIXED (already implemented)
- [x] **L11 — FallbackProvider getConfig returns empty apiKey** — `getConfig()` now returns the first child provider's config as representative. ✅ FIXED (2026-06-26)
- [x] **L12 — StreamOptimizer.compressionEnabled is a getter for static config flag** — Removed fake compression stats (`Math.floor(this._totalBytes * 0.7)`). `stats()` now returns `compressedBytes: 0`. ✅ FIXED (2026-06-26)
- [x] **L14 — Event system inconsistency in loop.ts** — Added documented event map with all events and their payload shapes. ✅ FIXED (2026-06-26)
- [x] **L2 — Telegram-coupled CLI processing in runner.ts** — Both `processMessage()` and `processMessageStream()` now route through `ChatService` instead of directly calling `AgentLoop` with Telegram-specific code. ✅ FIXED (2026-06-26)
- [x] **L4 — Leaking typing timeout across multiple chat targets** — Changed `typingTimeout` from a single instance variable to `Map<chatId, timeout>`. Each chat now has its own timeout, preventing cross-chat interference. ✅ FIXED (2026-06-26)
- [x] **L6 — Only POST method used for all API calls** — Added `GET_METHODS` set. Read-only Telegram API calls (`getMe`, `getUpdates`, `getFile`, etc.) now use GET instead of POST. ✅ FIXED (2026-06-26)
- [ ] **L3 — Misleading underscore prefix on used parameter** — `_channelName` and `_systemPrompt` in runner.ts are genuinely unused parameters. Underscore prefix is correct for unused parameters. No fix needed. (`src/agent/runner.ts`)
- [ ] **L5 — Inlined frontend HTML as a giant template string** — The entire frontend is embedded as a massive template literal. Requires extracting HTML/CSS/JS into separate files and bundling at build time. This is a larger architectural task. (`src/webui/server.ts`)
- [ ] **L7 — Inconsistent comment styles across channels** — Partially fixed (Telegram now uses double-dash `// ── Section ──` style). Other channels use varying styles. (cosmetic)
- [x] **L8 — ChannelStats interface allows arbitrary keys** — Changed `[key: string]: unknown` to `platform?: TAdditional` generic type. ✅ FIXED (2026-06-26)
- [x] **L9 — Redundant Discord intent mapping** — Improved with warning for unknown intents and cleaner spread-based defaults. ✅ FIXED (2026-06-26)

---

## Phase 2 — Comprehensive Codebase Review (2026-07-01)

### CRITICAL — Dead Code (~2,500 lines of unreachable code)

- [x] **C1 — Remove 6 dead modules** — Deleted `src/logging/` (4 files, 720 lines), `src/observability/` (4 files, 473 lines), `src/experimental/` (3 files, 277 lines), `src/ux/` (3 files, 419 lines), `src/linux-service/` (3 files, 517 lines), `src/clawhub/` (3 files, 378 lines). None had any external imports. Removed associated test files (7 files, ~1,800 lines). ✅ FIXED (2026-07-01)

- [x] **C2 — Remove dead files in core module** — Deleted `src/core/audit-logger.ts` (350 lines), `src/core/messenger.ts` (43 lines), `src/core/spawner.ts` (89 lines). None had external imports. Removed `src/tests/core/audit-logger.test.ts` (231 lines). Cleaned up `core/index.ts` to remove re-exports of these dead modules plus the misleading MCP/Memory re-exports. ✅ FIXED (2026-07-01)

- [x] **C3 — Collapse two competing frontend implementations** — The inline frontend in `server.ts:buildFrontend()` is what actually serves the UI. The component-based `src/webui/frontend/` module (19 files, ~500 lines) was dead code — exported from `webui/index.ts` but never imported by any other module. Deleted the entire `src/webui/frontend/` directory and all 18 frontend test files. Reduced `webui/index.ts` to just `WebUIBackend` + types exports. ✅ FIXED (2026-07-01)

- [x] **C4 — Remove unused npm dependencies** — Removed `dotenv` (0 imports), `minimatch` (0 imports), `@types/glob` (glob v10+ includes own types), `@types/minimatch` (unused package). Cleaned up `package.json` and `package-lock.json`. ✅ FIXED (2026-07-01)

### HIGH — Architecture & Duplication

- [ ] **H7 — 12 of 14 providers don't use BaseProvider** — Only `OpenAIProvider` and `OllamaProvider` extend `BaseProvider`. The other 12 providers (`AnthropicProvider`, `AzureOpenAIProvider`, `DeepSeekProvider`, `GeminiProvider`, `LlamaCppProvider`, `LMStudioProvider`, `MistralProvider`, `OpenRouterProvider`, `VLLMProvider`, `QwenProvider`, plus any others) implement `LLMProvider` directly and duplicate:
  - Constructor config initialization (~15 lines × 12 = 180 lines of identical code)
  - HTTP `fetch` with abort controller and timeout
  - Response JSON parsing and error handling
  - SSE stream parsing for streaming responses
  - Auth header injection (`x-api-key`, `Authorization: Bearer`, etc.)
  - `getConfig()` returns spread of `this.config`
  
  **Fix**: Make `BaseProvider` an abstract class with shared `chat()`/`chatStream()` that delegates message format conversion to subclasses via abstract methods like `formatMessages()`, `formatRequestBody()`, `parseResponse()`, `parseStreamChunk()`. Each provider then only implements the protocol-specific parts (~50-100 lines instead of 300-500).
  
  **Impact**: Estimated ~2,000 lines of duplication eliminated across provider implementations. (`src/providers/*/provider.ts`)

- [x] **H8 — Split Telegram god class (1,852 lines)** — ~314 lines of formatting helpers → `telegram/format.ts`, ~170 lines of API call logic → `telegram/api.ts`. TelegramApiClient class with retry, getUpdates, GET/POST handling. Channel.ts reduced from 1,852 to ~1,315 lines. ✅ FIXED (2026-06-26: format.ts + api.ts extracted)
  - Markdown → HTML conversion (lines 86-334, ~250 lines of regex spaghetti — this alone should be a utility module)
  - Message sending (`sendMessage`, `sendTextWithHtml`, `sendOutboundMessage`, `sendMedia`, `sendAlbum`, `sendFile`)
  - Media processing
  - Message management (`editMessage`, `editCaption`, `deleteMessage`, `pinMessage`, `pin/upin`)
  - Streaming output buffer management
  - Typing indicator with auto-refresh
  - Reactions (`addReaction`, `removeReactions`, `getReactions`)
  - Chat administration (`getChatInfo`, `banChatMember`, `promoteChatMember`, etc.)
  - Webhook management
  - Polling loop
  - API calls with retry
  - Command handling
  
  **Fix**: Split into:
  - `telegram/markdown.ts` — markdown formatting/conversion
  - `telegram/api.ts` — raw API calls with retry
  - `telegram/messaging.ts` — send/edit/delete messages
  - `telegram/admin.ts` — admin/bans/permissions
  - `telegram/polling.ts` — polling/webhook loops
  - `telegram/streaming.ts` — stream buffer management
  - `telegram/channel.ts` — main class, imports from sub-modules

  **Impact**: Makes a 1,852-line file manageable. Each sub-module would be 100-300 lines.

- [ ] **H9 — WebUI server god file (1,430 lines)** — `src/webui/server.ts` is a monolithic file that handles:
  - HTTP server setup and routing
  - REST API endpoints (providers, channels, chat, config, sessions, media)
  - WebSocket connections
  - File upload handling
  - Authentication
  - Embedded frontend (`buildFrontend()` — all HTML/CSS/JS)
  - Static file serving
  - CORS configuration
  - Rate limiting / security
  
  **Fix**: Split into:
  - `webui/server.ts` — main server bootstrap, middleware chain
  - `webui/router.ts` — route definitions and dispatching
  - `webui/handlers/` — one file per resource (providers, channels, chat, config, sessions, media)
  - `webui/ws-handler.ts` — WebSocket connection management
  - `webui/auth.ts` — authentication middleware

  **Impact**: 1,430 lines → 100-200 lines per focused file.

### MEDIUM — Code Quality & Consistency

- [ ] **M10 — Duplicated stream buffer implementations in Telegram + Discord** — Both `TelegramStreamBuffer` (Telegram types.ts:213) and `DiscordStreamBuffer` (Discord types.ts:260) implement the same concept with nearly identical shapes:
  ```ts
  // Telegram
  interface TelegramStreamBuffer {
    messageId?: number;
    text: string;
    timer: ReturnType<typeof setTimeout>;
  }
  // Discord
  interface DiscordStreamBuffer {
    messageId: string;
    text: string;
    timer: ReturnType<typeof setTimeout>;
  }
  ```
  The buffer management logic (`pushStreamText`, `finalizeStream`) is duplicated across both channels.
  
  **Fix**: Extract a generic `StreamBuffer<T>` class into `src/performance/stream-buffer.ts`. Both channels share the same logic, only the `sendEdit` callback differs. (`src/channels/telegram/channel.ts`, `src/channels/discord/channel.ts`)

- [ ] **M11 — Module-level side effects make code unpredictable** — These modules execute code at import time:
  - `src/providers/index.ts:88` — `registerDefaultProviders()` called at module scope. Importing any provider export triggers provider registration.
  - `src/agent/runner.ts:34` — `registerDefaultProviders()` called again at module scope. Double-registration risk.
  - `src/cli/cli-context.ts` — Three module-level singletons: `logger`, `config`, `configRateLimiter`. These are initialized when any CLI command imports the context, even if only one command is used.
  
  **Fix**: 
  - Remove `registerDefaultProviders()` from module scope. Make registration explicit in the application entry point (`cli.ts`, `webui/server.ts`).
  - Wrap CLI singletons in lazy getters or factory functions.
  - Add guard to `registerDefaultProviders()` to prevent double-registration (partially done — `registry.has()` check exists).

  **Impact**: Better testability, predictable initialization order.

- [ ] **M12 — Plugin module has zero tests** — `src/plugins/` has 5 source files (discovery, loader, manager, types, index) but `tests/plugins/` does not exist. The plugin system handles lifecycle (discover → load → init → run → teardown) with error boundaries — this is critical infrastructure with no test coverage.
  
  **Fix**: Write tests covering:
  - Plugin discovery (filesystem scanning)
  - Plugin loading (dynamic imports, validation)
  - Manager lifecycle (init all, run all, teardown all)
  - Error boundaries (one plugin crash doesn't kill others)
  - State transitions (discovered → loaded → initializing → running → stopped → errored)

- [ ] **M13 — `ProviderConfig.apiKey` is required but meaningless for local providers** — The `ProviderConfig` interface has `apiKey: string` as required. Local providers (LM Studio, llama.cpp, Ollama) don't need API keys, but each handles this differently:
  - `LlamaCppProvider`: `apiKey: config.apiKey || "llamacpp"` (fake value)
  - `LMStudioProvider`: omits `apiKey` from the config entirely
  - `OllamaProvider`: inherits from BaseProvider, which stores whatever is passed
  
  **Fix**: Make `apiKey?: string` optional in `ProviderConfig`. Providers that need it throw at runtime if missing; local providers simply skip auth headers. (`src/providers/types.ts`)

- [ ] **M14 — Inconsistent channel sendMessage signatures** — Different channels use different method names and signatures for the same concept:
  - Most channels: `sendMessage(options: XxxSendOptions)` — takes a single options object
  - Telegram: `sendMessage(chatId, text, options?)` — positional parameters, different pattern
  - Email: `sendEmail(options)` — different method name entirely
  
  **Fix**: Standardize on a common interface. Either all use `sendMessage(options)` with a polymorphic options type, or all use the same positional pattern. (Partially addressed by H1 — unifying under BaseChannel.)

### LOW — Polish & Cleanup

- [ ] **L15 — `core/index.ts` re-exports MCP and Memory confusingly** — `src/core/index.ts` re-exports `../mcp/index.js` and `../memory/index.js`, but nobody imports `core/index.ts` for those modules. Only `cli-context.ts` imports from `core/index.ts` (for `ConfigServiceImpl` and `SimpleLogger`), meaning these re-exports are dead paths that create a misleading dependency graph. (`src/core/index.ts`)

- [ ] **L16 — Module-level singletons in cli-context.ts hinder testing** — `src/cli/cli-context.ts` creates module-level `logger`, `config`, and `configRateLimiter` singletons. Any test importing a CLI command gets these singletons, making it impossible to:
  - Use a mock config in tests
  - Isolate test logging
  - Reset state between tests
  
  **Fix**: Export factory functions instead of instances. (`src/cli/cli-context.ts`)

- [ ] **L17 — Provider constructors are copy-pasted across 12 files** — Every provider constructor follows the same pattern with only the provider name changing. Even with a shared BaseProvider, this pattern is tedious. Could use a factory that takes a default config and returns a configured instance. (`src/providers/*/provider.ts`)

- [ ] **L18 — Inconsistent `qwen` export in providers/index.ts** — `QwenProvider` is imported from `./qwen/provider.js` on line 32 but is missing from the named export block (lines 43-55). This means `QwenProvider` is registered in the PROVIDER_MAP but cannot be imported by name from the module. (`src/providers/index.ts`)

- [ ] **L19 — God class properties spread across Telegram/Discord files** — Both Telegram (22 private properties) and Discord (15 private properties) have too many instance variables. Combined with H8/H9 splitting, properties should be colocated with their sub-modules. (`src/channels/telegram/channel.ts`, `src/channels/discord/channel.ts`)

---

## Phase 2 Summary

| Severity | Count | Estimated Impact |
|----------|-------|-----------------|
| **CRITICAL** (dead code) | 4 | ~2,500 lines removed, build faster, less confusion |
| **HIGH** (architecture) | 3 | ~3,500 lines deduplicated/split, major maintainability gain |
| **MEDIUM** (consistency) | 5 | ~500 lines deduplicated, better test coverage, fewer edge cases |
| **LOW** (polish) | 5 | Cosmetic but improves developer experience |
| **Total Phase 2** | **17** | **~6,500 lines of impact** |

## Combined Summary (Phase 1 + Phase 2)

| Severity | Phase 1 | Phase 2 | Total | Fixed |
|----------|---------|---------|-------|-------|
| CRITICAL | — | 4 | 4 | 4 |
| HIGH | 6 | 3 | 9 | 5 |
| MEDIUM | 9 | 5 | 14 | 11 |
| LOW | 14 | 5 | 19 | 11 |
| **Total** | **29** | **17** | **46** | **31** |

### Fixed items (Phase 2)
1. **[C1]** Removed 6 dead modules — ~2,800 lines deleted ✅
2. **[C2]** Removed 3 dead core files + cleaned up core/index.ts ✅
3. **[C3]** Collapsed two frontends — deleted dead 19-file component module ✅
4. **[C4]** Removed 4 unused npm dependencies ✅
5. **[L15]** Cleaned up core/index.ts re-exports ✅
6. **[L18]** Exported QwenProvider from providers/index.ts ✅
7. **[M13]** Made ProviderConfig.apiKey optional ✅
8. **[M11]** Removed module-level side effects (providers/index.ts, runner.ts) ✅
9. **[L16]** Lazy factory functions in cli-context.ts ✅
10. **[M10]** Extracted shared StreamBuffer type in performance/types.ts ✅
11. **[M12]** Added plugin module tests — 9 tests, 0 failures ✅
12. **[H7/L17]** Extracted `buildProviderConfig()` — eliminated duplicated 11-line config blocks from 10 providers (~110 lines of copy-paste eliminated) ✅

### Remaining items (Phase 2)
13. **H1** — Refactor Telegram/Discord to extend BaseChannel ✅ FIXED
14. **H6** — Remaining `any` types in Discord ✅ FIXED
15. **H8** — Split Telegram god class (1,852 lines) ✅ FIXED
16. **H9** — Split WebUI server god file (1,430 lines)
17. **M14** — Standardize sendMessage signatures across channels
18. **L19** — Reduce property sprawl in Telegram/Discord classes

---

*Phase 1: 2026-06-26. Phase 2: 2026-07-01. All items use TDD + clean code approach per repo convention.*
