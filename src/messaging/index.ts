/**
 * Messaging — Unified chat pipeline
 *
 * Provides a ChatService that all interfaces (WebUI, CLI, channels)
 * route through for a consistent message-processing experience.
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
