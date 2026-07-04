/**
 * Messaging — Unified chat pipeline
 *
 * Provides a ChatService (used by CLI/TUI) and shared type definitions
 * used by WebUI, channels, and CLI.
 *
 * Note: WebUI routes directly through WebUIBackend, not ChatService.
 */

export { ChatService } from "./chat-service.js";
export type {
	ChatMessage,
	ChatRequest,
	ChatResponse,
	ChatState,
	ChatStateListener,
	CompletionHandler,
	LLMProviderConfig,
	ProviderManagerLike,
} from "./types.js";
