# Changelog

All notable changes to synthtek will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Channel wiring standardisation (H5)**: All 14 channels now wire through a single `wireChannel()` duck-type interface. Added `onMessage()`/`sendMessage()` to WebSocket and WeChat channels. WebSocket renamed `start/stop` → `connect/disconnect` with backward-compatible aliases. Added WeChat start method in runner.ts. All start methods now use `wireChannel()` with proper `await connect()`. Fixed pre-existing WebUI server test failure (missing `/api/plugins` route). ✅ 1,316 tests passing, 0 failing.
- **Documentation**: Added e2e test results (6 Playwright tests passing) to README and ARCHITECTURE.md
- **Documentation**: Expanded docs/ARCHITECTURE.md with full module map (14 channels, 14 providers, memory, security, MCP, WebUI, CLI)

### Changed
- **Runner type safety**: Replaced 14 `as any` casts in `src/agent/runner.ts` with proper `NonNullable<ChannelConfigs['channel']>` types for all channel start methods
- **Telegram channel types**: Replaced `any` types in `src/channels/telegram/channel.ts` with `TelegramApiResponse<T>`, `TelegramChatMember`, and `Record<string, unknown>` for raw API response parsing
- **Code cleanup**: Removed `src/@eaDir/` Synology artifact, root `.DS_Store` file
- **Type hygiene**: Added cross-reference comments between duplicate `AgentLoopConfig` types in `src/config/schema.ts` and `src/agent/types.ts`

### Fixed
- **WebUI server**: Added missing `/api/plugins` route handler (was declared as public endpoint in auth.ts but returned 404)

## [0.1.0] — 2026-04-20

### Added
- Initial project scaffolding
- Plugin system foundation
- Provider abstraction layer
- Agent loop core

---

## Version History

| Version | Date       | Notes                          |
|---------|------------|--------------------------------|
| 0.1.0   | 2026-04-20 | Initial release                |
| 0.2.0   | 2026-04-22 | Logging module, Docker Compose |
