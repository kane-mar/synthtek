# Changelog

All notable changes to synthtek will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Documentation**: Added e2e test results (6 Playwright tests passing) to README and ARCHITECTURE.md
- **Documentation**: Expanded docs/ARCHITECTURE.md with full module map (14 channels, 14 providers, memory, security, MCP, WebUI, CLI)

### Changed
- **Runner type safety**: Replaced 14 `as any` casts in `src/agent/runner.ts` with proper `NonNullable<ChannelConfigs['channel']>` types for all channel start methods
- **Telegram channel types**: Replaced `any` types in `src/channels/telegram/channel.ts` with `TelegramApiResponse<T>`, `TelegramChatMember`, and `Record<string, unknown>` for raw API response parsing
- **Documentation**: Updated README.md badges, stats, and features list. Updated ARCHITECTURE.md date and test counts.
- **Code cleanup**: Removed `src/@eaDir/` Synology artifact, root `.DS_Store` file
- **Lint fix**: Applied Biome auto-format to `src/agent/loop.test.ts` and `src/agent/runner.ts`
- **Type hygiene**: Added cross-reference comments between duplicate `AgentLoopConfig` types in `src/config/schema.ts` and `src/agent/types.ts`

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
