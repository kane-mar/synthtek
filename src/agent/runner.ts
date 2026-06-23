/**
 * Agent Runner — wires AgentLoop + providers + TelegramChannel together
 */

import { TelegramChannel } from "../channels/telegram/channel.js";
import type {
	TelegramConfig,
	TelegramMessage,
} from "../channels/telegram/types.js";
import { getSystemPrompt } from "../config/agent-config.js";
import { SimpleLogger } from "../core/logger.js";
import {
	createFallbackProvider,
	type FallbackConfig,
} from "../providers/fallback.js";
import {
	getRegistry,
	type ProviderConfig,
	registerDefaultProviders,
} from "../providers/index.js";
import type { LLMProvider } from "../providers/types.js";
import { type AgentHooks, AgentLoop, type AgentLoopConfig } from "./index.js";

registerDefaultProviders();

export interface AgentRunnerConfig {
	/** Provider type to use (openai, anthropic, openrouter, ollama, lmstudio, llamacpp) */
	provider: string;
	/** API key for the provider */
	apiKey: string;
	/** Base URL (for custom endpoints like Ollama, LMStudio) */
	baseUrl?: string;
	/** Model to use */
	model?: string;
	/** Telegram bot token (optional — if omitted, runs in CLI-only mode) */
	telegramToken?: string;
	/** Telegram webhook URL (optional) */
	telegramWebhookUrl?: string;
	/** System prompt for the agent */
	systemPrompt?: string;
	/** Agent loop configuration overrides */
	loopConfig?: Partial<AgentLoopConfig>;
	/** Whether to use fallback across multiple providers */
	useFallback?: boolean;
	/** Fallback provider configs (if useFallback is true) */
	fallbackProviders?: ProviderConfig[];
	/** Log level */
	logLevel?: "debug" | "info" | "warn" | "error";
	/** Whether to stream responses to stdout */
	streamOutput?: boolean;
}

export class AgentRunner {
	private logger: SimpleLogger;
	private loop: AgentLoop;
	private telegram?: TelegramChannel;
	private config: AgentRunnerConfig;
	private running: boolean;
	private providers: LLMProvider[];

	constructor(config: AgentRunnerConfig) {
		this.config = config;
		this.logger = new SimpleLogger({
			level: config.logLevel ?? "info",
			prefix: "synthtek-agent",
		});
		this.running = false;

		// Build hooks
		const hooks: AgentHooks = {
			onInit: async () => {
				this.logger.info("Agent initialized");
			},
			onDestroy: async () => {
				this.logger.info("Agent destroyed");
			},
			onBeforeMessage: async (message) => {
				this.logger.debug("Processing message", { role: message.role });
			},
			onAfterMessage: async (result) => {
				this.logger.info("Message processed", {
					tokens: result.tokensUsed,
					toolCalls: result.toolCallsMade,
					duration: `${result.duration}ms`,
					errors: result.errors.length > 0 ? result.errors : undefined,
				});
			},
			onBeforeLLMCall: async (messages) => {
				this.logger.debug("LLM call", { messageCount: messages.length });
			},
			onAfterLLMCall: async (response, tokens) => {
				this.logger.debug("LLM response", {
					tokens,
					preview: response.slice(0, 100),
				});
			},
			onBeforeToolCall: async (toolCall) => {
				this.logger.info(`Executing tool: ${toolCall.name}`, {
					args: JSON.stringify(toolCall.arguments).slice(0, 200),
				});
			},
			onAfterToolCall: async (result) => {
				if (result.error) {
					this.logger.error(`Tool "${result.name}" failed`, {
						error: result.error,
					});
				} else {
					this.logger.debug(`Tool "${result.name}" succeeded`, {
						content: result.content.slice(0, 200),
					});
				}
			},
		};

		// Build loop config
		const loopConfig: AgentLoopConfig = {
			systemPrompt: config.systemPrompt ?? getSystemPrompt(),
			maxToolCalls: 20,
			responseFormat: "markdown",
			...config.loopConfig,
		};

		this.loop = new AgentLoop(loopConfig, hooks);

		// Build providers
		this.providers = [];
		if (config.useFallback && config.fallbackProviders) {
			const fallbackConfig: FallbackConfig = {
				providers: config.fallbackProviders,
				log: true,
			};
			const multiProvider = createFallbackProvider(fallbackConfig);
			this.providers.push(multiProvider);
		} else {
			const registry = getRegistry();
			const providerConfig: ProviderConfig = {
				provider: config.provider,
				apiKey: config.apiKey,
				baseUrl: config.baseUrl,
				model: config.model,
			};
			const provider = registry.create(config.provider as any, providerConfig);
			this.providers.push(provider);
		}
	}

	/** Start the agent runner */
	async start(): Promise<void> {
		if (this.running) {
			this.logger.warn("Agent runner is already running");
			return;
		}

		this.running = true;

		// Start the agent loop
		await this.loop.start();
		this.logger.info("Agent loop started");

		// Start Telegram channel if configured
		if (this.config.telegramToken) {
			await this.startTelegram();
		} else {
			this.logger.info(
				"No Telegram token configured — running in CLI-only mode",
			);
		}

		// Set up signal handlers for graceful shutdown
		this.setupSignalHandlers();
	}

	/** Stop the agent runner */
	async stop(): Promise<void> {
		if (!this.running) return;

		this.logger.info("Stopping agent runner...");
		this.running = false;

		// Stop Telegram channel
		if (this.telegram) {
			await this.telegram.stop();
			this.logger.info("Telegram channel stopped");
		}

		// Stop agent loop
		await this.loop.stop();
		this.logger.info("Agent loop stopped");
	}

	/** Process a message through the agent loop */
	async processMessage(
		content: string,
		chatId: number | string,
		fromId?: number,
		fromUsername?: string,
	): Promise<void> {
		const provider = this.providers[0];

		// Show typing indicator
		if (this.telegram) {
			await this.telegram.sendTyping(chatId);
		}

		const result = await this.loop.processMessage(
			{
				role: "user",
				content,
				metadata: { chatId, fromId, fromUsername },
			},
			provider,
		);

		// Send response
		if (this.telegram) {
			await this.telegram.sendTyping(chatId, "typing");
			await this.telegram.sendMessage(chatId, result.response);
		} else {
			console.log(result.response);
		}
	}

	/** Process a message with streaming output */
	async processMessageStream(
		_content: string,
		chatId: number | string,
		_fromId?: number,
		_fromUsername?: string,
	): Promise<void> {
		const provider = this.providers[0];

		if (this.telegram) {
			await this.telegram.sendTyping(chatId);
		}

		let accumulated = "";
		let firstChunk = true;

		for await (const chunk of provider.chatStream({
			messages: this.loop
				.getContext()
				.getFormattedMessages() as import("../providers/types.js").ProviderMessage[],
			model: this.config.model ?? provider.getConfig().model ?? "default",
			system: this.config.systemPrompt,
		})) {
			accumulated += chunk.delta;

			if (this.telegram) {
				if (firstChunk) {
					firstChunk = false;
					await this.telegram.sendTyping(chatId, "typing");
				}
				// For streaming, we'd need to track the message ID and edit it
				// For now, just accumulate and send at the end
			}
		}

		if (this.telegram) {
			await this.telegram.sendMessage(chatId, accumulated);
		} else {
			console.log(accumulated);
		}
	}

	// ── Private helpers ──────────────────────────────────────────────────────

	private async startTelegram(): Promise<void> {
		const config: TelegramConfig = {
			token: this.config.telegramToken!,
			usePolling: true,
			pollingTimeout: 30,
			maxRetries: 5,
			retryDelay: 1000,
		};

		if (this.config.telegramWebhookUrl) {
			config.usePolling = false;
			config.webhookUrl = this.config.telegramWebhookUrl;
		}

		this.telegram = new TelegramChannel(config);

		this.telegram.start(
			async (message: TelegramMessage) => {
				if (!message.text && !message.caption) return;
				const content = message.text || message.caption || "";
				await this.processMessage(
					content,
					message.chatId,
					message.fromId,
					message.fromUsername,
				);
			},
			(error: Error) => {
				this.logger.error("Telegram error", { error: error.message });
			},
		);

		this.logger.info("Telegram channel started");
	}

	private setupSignalHandlers(): void {
		const handleShutdown = async (signal: string) => {
			this.logger.info(`Received ${signal}, shutting down...`);
			await this.stop();
			process.exit(0);
		};

		process.on("SIGINT", () => handleShutdown("SIGINT"));
		process.on("SIGTERM", () => handleShutdown("SIGTERM"));
	}
}

/**
 * Create an AgentRunner from environment variables or config object.
 *
 * Environment variables:
 *   SYNTHTEK_PROVIDER   — provider type (openai, anthropic, openrouter, ollama, lmstudio, llamacpp)
 *   SYNTHTEK_API_KEY    — API key
 *   SYNTHTEK_BASE_URL   — custom base URL
 *   SYNTHTEK_MODEL      — model name
 *   SYNTHTEK_TELEGRAM_TOKEN — Telegram bot token
 *   SYNTHTEK_TELEGRAM_WEBHOOK_URL — Telegram webhook URL
 *   SYNTHTEK_SYSTEM_PROMPT — system prompt
 *   SYNTHTEK_LOG_LEVEL  — log level
 *   SYNTHTEK_STREAM     — stream output (true/false)
 */
export function createAgentRunnerFromEnv(): AgentRunner {
	const config: AgentRunnerConfig = {
		provider: process.env.SYNTHTEK_PROVIDER ?? "openai",
		apiKey: process.env.SYNTHTEK_API_KEY ?? "",
		baseUrl: process.env.SYNTHTEK_BASE_URL,
		model: process.env.SYNTHTEK_MODEL,
		telegramToken: process.env.SYNTHTEK_TELEGRAM_TOKEN,
		telegramWebhookUrl: process.env.SYNTHTEK_TELEGRAM_WEBHOOK_URL,
		systemPrompt: process.env.SYNTHTEK_SYSTEM_PROMPT,
		logLevel:
			(process.env.SYNTHTEK_LOG_LEVEL as "debug" | "info" | "warn" | "error") ??
			"info",
		streamOutput: process.env.SYNTHTEK_STREAM === "true",
	};

	return new AgentRunner(config);
}
