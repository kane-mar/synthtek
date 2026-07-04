/**
 * ChatService — Unified messaging service for CLI and TUI.
 *
 * Provides a consistent message-processing pipeline. WebUI routes through
 * WebUIBackend directly (not through ChatService), but CLI/TUI uses this
 * for its interactive chat mode.
 *
 * Usage:
 *   const chat = new ChatService(providerManager);
 *   chat.onStateChange(state => { updateUI(state); });
 *   const response = await chat.sendMessage({ messages, system: '...' });
 */

import type {
	ChatMessage,
	ChatRequest,
	ChatResponse,
	ChatState,
	ChatStateListener,
	CompletionHandler,
	ProviderManagerLike,
} from "./types.js";

export class ChatService {
	private readonly completionHandler?: CompletionHandler;
	private state_: ChatState = {
		isLoading: false,
		isStreaming: false,
		error: null,
		lastActivity: null,
	};
	private readonly listeners: Set<ChatStateListener> = new Set();
	private readonly providerManager: ProviderManagerLike;

	constructor(
		providerManager: ProviderManagerLike,
		options?: { completionHandler?: CompletionHandler },
	) {
		this.providerManager = providerManager;
		this.completionHandler = options?.completionHandler;
	}

	// ── State ──────────────────────────────────────────────────────────────────

	getState(): ChatState {
		return { ...this.state_ };
	}

	onStateChange(listener: ChatStateListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	setLoading(loading: boolean): void {
		this.state_ = {
			...this.state_,
			isLoading: loading,
			lastActivity: loading ? null : Date.now(),
		};
		this.notifyListeners();
	}

	setStreaming(streaming: boolean): void {
		this.state_ = { ...this.state_, isStreaming: streaming };
		this.notifyListeners();
	}

	setError(error: string): void {
		this.state_ = {
			...this.state_,
			error,
			isLoading: false,
			isStreaming: false,
		};
		this.notifyListeners();
	}

	clearError(): void {
		this.state_ = { ...this.state_, error: null };
		this.notifyListeners();
	}

	reset(): void {
		this.state_ = {
			isLoading: false,
			isStreaming: false,
			error: null,
			lastActivity: null,
		};
		this.notifyListeners();
	}

	private notifyListeners(): void {
		const snapshot = this.getState();
		for (const listener of this.listeners) {
			try {
				listener(snapshot);
			} catch {
				// Listener errors must never break the service
			}
		}
	}

	// ── Message Processing ────────────────────────────────────────────────────

	/** Build the messages array, optionally prefixing with a system message */
	buildRequestMessages(
		messages: ChatMessage[],
		system?: string,
	): ChatMessage[] {
		if (system) {
			return [{ role: "system", content: system }, ...messages];
		}
		return messages;
	}

	/**
	 * Send a message through the unified pipeline.
	 * Returns the response content, or an error object.
	 */
	async sendMessage(request: ChatRequest): Promise<ChatResponse> {
		this.setLoading(true);
		this.clearError();

		try {
			// ── Resolve provider ──────────────────────────────────────────
			const active = this.providerManager.getActiveProvider(request.providerId);

			if (!active) {
				const error = request.providerId
					? "Specified provider not found or inactive"
					: "No active LLM providers configured. Go to Settings to add one.";
				this.setError(error);
				return { content: "", error };
			}

			const provider: { id: string; name: string; type: string } = active;

			// ── Build messages ────────────────────────────────────────────
			const messages = this.buildRequestMessages(
				request.messages,
				request.system,
			);

			// ── Send to provider ──────────────────────────────────────────
			const response = await this.executeCompletion(provider, messages);
			return response;
		} catch (err: unknown) {
			const error = err instanceof Error ? err.message : "Unknown error";
			this.setError(error);
			return { content: "", error };
		} finally {
			this.setLoading(false);
		}
	}

	/**
	 * Execute the actual LLM completion.
	 * Uses the injected completionHandler if available, otherwise returns
	 * a placeholder error (useful for testing or before attaching a handler).
	 */
	protected async executeCompletion(
		_provider: { id: string; name: string; type: string },
		_messages: ChatMessage[],
	): Promise<ChatResponse> {
		if (this.completionHandler) {
			return this.completionHandler(_provider, _messages);
		}
		return {
			content: "",
			error:
				"ChatService requires a concrete completion handler. Use WebUIServer or a custom adapter.",
		};
	}
}
