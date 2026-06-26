/**
 * Messaging Types — Shared across all channels, WebUI, and CLI
 */

export interface ChatMessage {
	role: "user" | "assistant" | "system";
	content: string;
}

export interface ChatRequest {
	messages: ChatMessage[];
	providerId?: string;
	system?: string;
	sessionId?: string;
}

export interface ChatResponse {
	content: string;
	model?: string;
	error?: string;
}

export interface ChatState {
	isLoading: boolean;
	isStreaming: boolean;
	error: string | null;
	lastActivity: number | null;
}

export type ChatStateListener = (state: ChatState) => void;

/** Minimal provider config shape needed by ChatService */
export interface LLMProviderConfig {
	id: string;
	name: string;
	type: string;
	status: string;
	apiKey?: string;
	baseUrl: string;
	models: string[];
	defaultModel: string;
	temperature: number;
	maxTokens: number;
	timeoutMs?: number;
	headers?: Record<string, string>;
}

/** Minimal provider manager interface for ChatService */
export interface ProviderManagerLike {
	list(): LLMProviderConfig[];
	find?(id: string): LLMProviderConfig | null;
	getActiveProvider(providerId?: string): LLMProviderConfig | null;
}

/** A function that executes the actual LLM completion call */
export type CompletionHandler = (
	provider: { id: string; name: string; type: string },
	messages: ChatMessage[],
) => Promise<ChatResponse>;
