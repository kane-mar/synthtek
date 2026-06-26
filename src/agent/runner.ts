/**
 * Agent Runner — wires channels + ChatService + providers together.
 *
 * All channels route through ChatService for unified message processing,
 * state management, and error handling — just like the WebUI and CLI/TUI.
 */

import { DiscordChannel } from "../channels/discord/channel.js";
import type { DiscordMessage } from "../channels/discord/types.js";
import type { SlackChannel } from "../channels/slack/channel.js";

import { TelegramChannel } from "../channels/telegram/channel.js";
import type {
	TelegramConfig,
	TelegramMessage,
} from "../channels/telegram/types.js";
import { getSystemPrompt } from "../config/agent-config.js";
import { SimpleLogger } from "../core/logger.js";
import type { ChannelConfigs } from "../messaging/channel-configs.js";
import { ChatService } from "../messaging/chat-service.js";
import type { ChatMessage, ChatResponse } from "../messaging/types.js";
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

export interface AgentRunnerConfig {
	/** Provider type to use (openai, anthropic, openrouter, ollama, lmstudio, llamacpp) */
	provider: string;
	/** API key for the provider */
	apiKey: string;
	/** Base URL (for custom endpoints like Ollama, LMStudio) */
	baseUrl?: string;
	/** Model to use */
	model?: string;
	/** Telegram bot token (legacy — prefer channelConfigs.telegram) */
	telegramToken?: string;
	/** Telegram webhook URL (legacy — prefer channelConfigs.telegram) */
	telegramWebhookUrl?: string;
	/** Channel configs — enable any channel via its config block */
	channelConfigs?: ChannelConfigs;
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
	private chatService?: ChatService;
	private telegram?: TelegramChannel;
	private discord?: DiscordChannel;
	private slack?: SlackChannel;
	/** All actively wired BaseChannel instances (for lifecycle management) */
	private activeChannels = new Set<{ disconnect: () => Promise<void> }>();
	private config: AgentRunnerConfig;
	private running: boolean;
	private providers: LLMProvider[];

	constructor(config: AgentRunnerConfig) {
		registerDefaultProviders();
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
			const provider = registry.create(
				config.provider as never,
				providerConfig,
			);
			this.providers.push(provider);
		}

		// Create unified ChatService that all channels route through
		this.createChatService();
	}

	/**
	 * Create the unified ChatService.
	 * Its completion handler delegates to the AgentLoop for full agent capabilities
	 * (tool calling, context management, multi-step reasoning).
	 */
	private createChatService(): void {
		const buildProviderMeta = (): {
			id: string;
			name: string;
			type: string;
			status: "active";
			apiKey: string;
			baseUrl: string;
			models: string[];
			defaultModel: string;
			temperature: number;
			maxTokens: number;
		} => ({
			id: this.config.provider,
			name: this.config.provider,
			type: this.config.provider,
			status: "active" as const,
			apiKey: this.config.apiKey,
			baseUrl: this.config.baseUrl ?? "",
			models: this.config.model ? [this.config.model] : [],
			defaultModel: this.config.model ?? "default",
			temperature: 0.7,
			maxTokens: 4096,
		});

		const providerManagerLike = {
			list: () => [buildProviderMeta()],
			find: (id: string) =>
				id === this.config.provider ? buildProviderMeta() : null,
			getActiveProvider: (providerId?: string) => {
				if (providerId) {
					return providerId === this.config.provider
						? buildProviderMeta()
						: null;
				}
				return buildProviderMeta();
			},
		};

		const systemPrompt = this.config.systemPrompt ?? getSystemPrompt();

		this.chatService = new ChatService(providerManagerLike, {
			completionHandler: async (_provider, messages) => {
				return this.executeAgentCompletion(messages, systemPrompt);
			},
		});
	}

	/**
	 * Execute the full agent completion pipeline.
	 * Delegates to AgentLoop for tool calling and multi-step reasoning.
	 */
	private async executeAgentCompletion(
		messages: ChatMessage[],
		_systemPrompt: string,
	): Promise<ChatResponse> {
		const provider = this.providers[0];
		if (!provider) {
			return { content: "", error: "No provider available" };
		}

		// Use the last user message (AgentLoop expects one message at a time)
		const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
		if (!lastUserMsg) {
			return { content: "", error: "No user message to process" };
		}

		try {
			const result = await this.loop.processMessage(
				{
					role: "user",
					content: lastUserMsg.content,
					metadata: {},
				},
				provider,
			);

			return {
				content: result.response,
				error: result.errors.length > 0 ? result.errors.join("; ") : undefined,
			};
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Unknown error";
			return { content: "", error: msg };
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

		// Start all configured channels
		await this.startConfiguredChannels();

		// Set up signal handlers for graceful shutdown
		this.setupSignalHandlers();
	}

	/** Start all configured channels (via channelConfigs + legacy telegram) */
	private async startConfiguredChannels(): Promise<void> {
		const channelConfigs = this.config.channelConfigs ?? {};

		// Legacy telegram config (backward compat)
		const telegramConfig: TelegramConfig | undefined =
			channelConfigs.telegram ??
			(this.config.telegramToken
				? {
						token: this.config.telegramToken,
						webhookUrl: this.config.telegramWebhookUrl,
						usePolling: !this.config.telegramWebhookUrl,
						pollingTimeout: 30,
						maxRetries: 5,
						retryDelay: 1000,
					}
				: undefined);

		const startPromises: Array<Promise<void>> = [];

		if (telegramConfig) {
			startPromises.push(this.startTelegram(telegramConfig));
		}
		if (channelConfigs.discord) {
			startPromises.push(this.startDiscord(channelConfigs.discord));
		}
		if (channelConfigs.slack) {
			startPromises.push(this.startSlack(channelConfigs.slack));
		}
		if (channelConfigs.wechat) {
			startPromises.push(this.startWeChat(channelConfigs.wechat));
		}
		if (channelConfigs.wecom) {
			startPromises.push(this.startWeCom(channelConfigs.wecom));
		}
		if (channelConfigs.feishu) {
			startPromises.push(this.startFeishu(channelConfigs.feishu));
		}
		if (channelConfigs.matrix) {
			startPromises.push(this.startMatrix(channelConfigs.matrix));
		}
		if (channelConfigs.qq) {
			startPromises.push(this.startQQ(channelConfigs.qq));
		}
		if (channelConfigs.dingtalk) {
			startPromises.push(this.startDingTalk(channelConfigs.dingtalk));
		}
		if (channelConfigs.email) {
			startPromises.push(this.startEmail(channelConfigs.email));
		}
		if (channelConfigs.teams) {
			startPromises.push(this.startTeams(channelConfigs.teams));
		}
		if (channelConfigs.whatsapp) {
			startPromises.push(this.startWhatsApp(channelConfigs.whatsapp));
		}
		if (channelConfigs.websocket) {
			startPromises.push(this.startWebSocket(channelConfigs.websocket));
		}

		if (startPromises.length === 0) {
			this.logger.info("No channels configured — running in CLI-only mode");
			return;
		}

		await Promise.allSettled(startPromises);
	}

	/** Stop the agent runner */
	async stop(): Promise<void> {
		if (!this.running) return;

		this.logger.info("Stopping agent runner...");
		this.running = false;

		// Stop all channels
		await this.stopAllChannels();

		// Stop agent loop
		await this.loop.stop();
		this.logger.info("Agent loop stopped");
	}

	private async stopAllChannels(): Promise<void> {
		const stopPromises: Array<Promise<void>> = [];

		if (this.telegram) {
			stopPromises.push(
				this.telegram
					.stop()
					.catch((e) =>
						this.logger.warn("Telegram stop error", { error: e.message }),
					),
			);
		}
		if (this.discord) {
			stopPromises.push(
				this.discord
					.stop()
					.catch((e: Error) =>
						this.logger.warn("Discord stop error", { error: e.message }),
					),
			);
		}
		if (this.slack) {
			stopPromises.push(
				this.slack
					.disconnect()
					.catch((e) =>
						this.logger.warn("Slack stop error", { error: e.message }),
					),
			);
		}

		// Disconnect all base-channel instances
		for (const ch of this.activeChannels) {
			stopPromises.push(
				ch
					.disconnect()
					.catch((e: Error) =>
						this.logger.warn("Channel disconnect error", { error: e.message }),
					),
			);
		}

		await Promise.allSettled(stopPromises);
	}

	// ── Channel-specific handlers ────────────────────────────────────────────
	// Each channel follows the same pattern:
	//   1. Create channel instance
	//   2. Wire message handler that calls chatService.sendMessage()
	//   3. Start/connect the channel

	/** Handle a message from any channel — routes through ChatService */
	private async handleChannelMessage(
		content: string,
		_channelName: string,
		sendResponse: (text: string) => Promise<void>,
	): Promise<void> {
		if (!this.chatService || !this.running) return;

		const result = await this.chatService.sendMessage({
			messages: [{ role: "user", content }],
			system: this.config.systemPrompt ?? getSystemPrompt(),
		});

		if (result.error) {
			await sendResponse(`Error: ${result.error}`);
			return;
		}

		await sendResponse(result.content);
	}

	// ── Telegram ─────────────────────────────────────────────────────────────

	private async startTelegram(config: TelegramConfig): Promise<void> {
		this.telegram = new TelegramChannel(config);
		await this.telegram.start(
			async (message: TelegramMessage) => {
				if (!message.text && !message.caption) return;
				const content = message.text || message.caption || "";
				await this.handleChannelMessage(content, "telegram", async (text) => {
					if (this.telegram) {
						await this.telegram.sendMessage(message.chatId, text);
					}
				});
			},
			(error: Error) => {
				this.logger.error("Telegram error", { error: error.message });
			},
		);
		this.logger.info("Telegram channel started");
	}

	// ── Discord ──────────────────────────────────────────────────────────────

	private async startDiscord(
		config: import("../channels/discord/types.js").DiscordConfig,
	): Promise<void> {
		this.discord = new DiscordChannel(config);
		this.discord.start(
			async (message: DiscordMessage) => {
				const content = message.text || "";
				if (!content) return;
				await this.handleChannelMessage(content, "discord", async (text) => {
					if (this.discord) {
						await this.discord.sendMessage(message.channelId, text);
					}
				});
			},
			(error: Error) => {
				this.logger.error("Discord error", { error: error.message });
			},
		);
		this.logger.info("Discord channel started");
	}

	/** Wire a generic BaseChannel to ChatService */
	private async wireBaseChannel(
		channel: {
			onMessage: (handler: (msg: any) => Promise<void>) => void;
			connect: () => Promise<void>;
			disconnect: () => Promise<void>;
			sendMessage: (options: any) => Promise<unknown>;
		},
		channelName: string,
	): Promise<void> {
		// Track for lifecycle management
		this.activeChannels.add(channel as { disconnect: () => Promise<void> });

		channel.onMessage(async (msg: any) => {
			const content = msg.text ?? msg.content ?? "";
			if (!content) return;
			await this.handleChannelMessage(content, channelName, async (text) => {
				try {
					await channel.sendMessage({ text, content: text, body: text });
				} catch (err: unknown) {
					const msg2 = err instanceof Error ? err.message : "send failed";
					this.logger.error(`${channelName} send error`, {
						error: msg2,
					});
				}
			});
		});
		await channel.connect();
		this.logger.info(`${channelName} channel started`);
	}

	// ── Slack ────────────────────────────────────────────────────────────────

	private async startSlack(
		config: import("../channels/slack/types.js").SlackConfig,
	): Promise<void> {
		const { SlackChannel } = await import("../channels/slack/channel.js");
		const slack = new SlackChannel(config) as any;
		this.slack = slack;
		await this.wireBaseChannel(slack, "slack");
	}

	// ── WeChat ───────────────────────────────────────────────────────────────

	private async startWeChat(
		config: import("../channels/wechat/types.js").WeChatConfig,
	): Promise<void> {
		const { WeChatChannel } = await import("../channels/wechat/channel.js");
		const channel = new WeChatChannel(config);
		await channel.connect();
		this.logger.info("WeChat channel started");
	}

	// ── WeCom ────────────────────────────────────────────────────────────────

	private async startWeCom(
		config: import("../channels/wecom/types.js").WeComConfig,
	): Promise<void> {
		const { WeComChannel } = await import("../channels/wecom/channel.js");
		await this.wireBaseChannel(new WeComChannel(config), "wecom");
	}

	// ── Feishu ───────────────────────────────────────────────────────────────

	private async startFeishu(
		config: import("../channels/feishu/types.js").FeishuConfig,
	): Promise<void> {
		const { FeishuChannel } = await import("../channels/feishu/channel.js");
		await this.wireBaseChannel(new FeishuChannel(config), "feishu");
	}

	// ── Matrix ───────────────────────────────────────────────────────────────

	private async startMatrix(
		config: import("../channels/matrix/types.js").MatrixConfig,
	): Promise<void> {
		const { MatrixChannel } = await import("../channels/matrix/channel.js");
		await this.wireBaseChannel(new MatrixChannel(config), "matrix");
	}

	// ── QQ ───────────────────────────────────────────────────────────────────

	private async startQQ(
		config: import("../channels/qq/types.js").QQConfig,
	): Promise<void> {
		const { QQChannel } = await import("../channels/qq/channel.js");
		await this.wireBaseChannel(new QQChannel(config), "qq");
	}

	// ── DingTalk ─────────────────────────────────────────────────────────────

	private async startDingTalk(
		config: import("../channels/dingtalk/types.js").DingTalkConfig,
	): Promise<void> {
		const { DingTalkChannel } = await import("../channels/dingtalk/channel.js");
		await this.wireBaseChannel(new DingTalkChannel(config), "dingtalk");
	}

	// ── Email ────────────────────────────────────────────────────────────────

	private async startEmail(
		config: import("../channels/email/types.js").EmailConfig,
	): Promise<void> {
		const { EmailChannel } = await import("../channels/email/channel.js");
		const channel = new EmailChannel(config);
		channel.onMessage(async (msg: any) => {
			const content = msg.text ?? msg.content ?? "";
			if (!content) return;
			await this.handleChannelMessage(content, "email", async (text) => {
				try {
					await channel.sendEmail({ to: "", subject: "", text });
				} catch (err: unknown) {
					this.logger.error("email send error", {
						error: err instanceof Error ? err.message : "send failed",
					});
				}
			});
		});
		await channel.connect();
		this.logger.info("email channel started");
	}

	// ── Teams ────────────────────────────────────────────────────────────────

	private async startTeams(
		config: import("../channels/teams/types.js").TeamsConfig,
	): Promise<void> {
		const { TeamsChannel } = await import("../channels/teams/channel.js");
		await this.wireBaseChannel(new TeamsChannel(config), "teams");
	}

	// ── WhatsApp ─────────────────────────────────────────────────────────────

	private async startWhatsApp(
		config: import("../channels/whatsapp/types.js").WhatsAppConfig,
	): Promise<void> {
		const { WhatsAppChannel } = await import("../channels/whatsapp/channel.js");
		await this.wireBaseChannel(new WhatsAppChannel(config), "whatsapp");
	}

	// ── WebSocket ────────────────────────────────────────────────────────────

	private async startWebSocket(
		_config: import("../channels/websocket/types.js").WebSocketChannelConfig,
	): Promise<void> {
		this.logger.info(
			"WebSocket channel configured (start pending implementation)",
		);
	}

	// ── CLI message processing (kept for backward compat) ────────────────────

	/** Process a message through ChatService (for CLI/API use) */
	async processMessage(
		content: string,
		_chatId?: number | string,
		_fromId?: number,
		_fromUsername?: string,
	): Promise<void> {
		if (!this.chatService || !this.running) {
			console.log("Agent is not running. Call start() first.");
			return;
		}

		const result = await this.chatService.sendMessage({
			messages: [{ role: "user", content }],
			system: this.config.systemPrompt ?? getSystemPrompt(),
		});

		if (result.error) {
			console.error(`Error: ${result.error}`);
			return;
		}

		console.log(result.content);
	}

	/** Process a message with streaming output (legacy — prefer processMessage) */
	async processMessageStream(
		content: string,
		_chatId?: number | string,
		_fromId?: number,
		_fromUsername?: string,
	): Promise<void> {
		if (!this.chatService || !this.running) {
			console.log("Agent is not running. Call start() first.");
			return;
		}

		const result = await this.chatService.sendMessage({
			messages: [{ role: "user", content }],
			system: this.config.systemPrompt ?? getSystemPrompt(),
		});

		if (result.error) {
			console.error(`Error: ${result.error}`);
			return;
		}

		console.log(result.content);
	}

	// ── Private helpers ──────────────────────────────────────────────────────

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
