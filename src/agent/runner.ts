/**
 * Agent Runner — wires channels + AgentSession + providers together.
 *
 * All channels route through AgentSession (AgentLoop + tools + conversation store)
 * for unified message processing, state management, and context isolation.
 * Each channel conversation gets its own AgentSession instance.
 *
 * This is the same AgentSession that WebUI and TUI use — ensuring consistent
 * tool availability and seamless cross-interface conversations.
 */

import { getAgentConfig, getSystemPrompt } from "../config/agent-config.js";
import { SimpleLogger } from "../core/logger.js";
import type { ChannelConfigs } from "../messaging/channel-configs.js";
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
import { AgentSession } from "./session.js";
import type { AgentLoopConfig } from "./types.js";

export interface AgentRunnerConfig {
	provider: string;
	apiKey: string;
	baseUrl?: string;
	model?: string;
	telegramToken?: string;
	telegramWebhookUrl?: string;
	channelConfigs?: ChannelConfigs;
	systemPrompt?: string;
	loopConfig?: Partial<AgentLoopConfig>;
	useFallback?: boolean;
	fallbackProviders?: ProviderConfig[];
	logLevel?: "debug" | "info" | "warn" | "error";
	streamOutput?: boolean;
	workspaceDir?: string;
}

type SessionMap = Map<string, AgentSession>;

export class AgentRunner {
	private logger: SimpleLogger;
	private config: AgentRunnerConfig;
	private running: boolean;
	private providers: LLMProvider[];
	private sessions: SessionMap;
	private systemPrompt: string;
	private activeChannels = new Set<{ disconnect: () => Promise<void> }>();

	constructor(config: AgentRunnerConfig) {
		registerDefaultProviders();
		this.config = config;
		this.logger = new SimpleLogger({
			level: config.logLevel ?? "info",
			prefix: "synthtek-agent",
		});
		this.running = false;
		this.providers = [];
		this.sessions = new Map();
		this.systemPrompt = config.systemPrompt ?? getSystemPrompt();

		if (config.useFallback && config.fallbackProviders) {
			const fallbackConfig: FallbackConfig = {
				providers: config.fallbackProviders.map((p) => ({
					provider: p.provider,
					apiKey: p.apiKey,
					baseUrl: p.baseUrl,
					model: p.model,
				})),
			};
			this.providers = [createFallbackProvider(fallbackConfig)];
		} else {
			const providerType =
				config.provider as import("../providers/types.js").ProviderType;
			const registry = getRegistry();
			if (registry.has(providerType)) {
				this.providers.push(
					registry.create(providerType, {
						provider: providerType,
						apiKey: config.apiKey,
						baseUrl: config.baseUrl,
						model: config.model,
					}),
				);
			}
		}

		if (this.providers.length === 0) {
			this.logger.warn("No providers configured");
		}
	}

	/**
	 * Sync all cached sessions with the current shared config.
	 * Call this after `setAgentConfig()` to propagate changes to running sessions.
	 */
	syncAllSessions(): void {
		const agentCfg = getAgentConfig();
		for (const [_id, session] of this.sessions) {
			session.updateConfig({
				maxToolCalls: agentCfg.maxToolCalls,
				maxTokens: agentCfg.maxTokens,
				loopConfig: {
					retry: {
						maxRetries: agentCfg.maxRetries,
						initialDelay: 1000,
						maxDelay: 10000,
						multiplier: 2,
					},
					temperature: agentCfg.temperature,
				},
			});
		}
		this.logger.debug(
			`Synced ${this.sessions.size} sessions with shared config`,
		);
	}

	/**
	 * Clear all cached sessions (they will be recreated on next message).
	 */
	clearSessions(): void {
		this.sessions.clear();
		this.logger.debug("Cleared all sessions");
	}

	// ── Session Management ──────────────────────────────────────────────────

	private getOrCreateSession(conversationId: string): AgentSession | null {
		const provider = this.providers[0];
		if (!provider) return null;
		let session = this.sessions.get(conversationId);
		if (!session) {
			// Read agent parameters from shared config
			const agentCfg = getAgentConfig();
			session = new AgentSession(provider, {
				systemPrompt: this.systemPrompt,
				maxToolCalls: agentCfg.maxToolCalls,
				maxTokens: agentCfg.maxTokens,
				responseFormat: "markdown",
				autoPersist: true,
				loopConfig: {
					retry: {
						maxRetries: agentCfg.maxRetries,
						initialDelay: 1000,
						maxDelay: 10000,
						multiplier: 2,
					},
					temperature: agentCfg.temperature,
				},
				workspaceDir:
					this.config.workspaceDir ??
					process.env.SYNTHTEK_WORKSPACE ??
					process.cwd(),
			});
			this.sessions.set(conversationId, session);
			this.logger.debug(
				`Created session for ${conversationId} (maxToolCalls=${agentCfg.maxToolCalls}, temp=${agentCfg.temperature})`,
			);
		}
		return session;
	}

	// ── Unified Message Handler ────────────────────────────────────────────

	private async handleMessage(
		content: string,
		conversationId: string,
		sendResponse: (text: string) => Promise<void>,
	): Promise<void> {
		if (!this.running) return;
		const session = this.getOrCreateSession(conversationId);
		if (!session) {
			await sendResponse("No LLM provider is configured.");
			return;
		}
		try {
			const response = await session.processMessage(content, conversationId);
			await sendResponse(response.response);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Unknown error";
			this.logger.error(`Error processing ${conversationId}`, { error: msg });
			await sendResponse(`Error: ${msg}`);
		}
	}

	// ── Lifecycle ───────────────────────────────────────────────────────────

	async start(): Promise<void> {
		if (this.running) {
			this.logger.warn("Agent runner is already running");
			return;
		}
		this.running = true;
		this.logger.info("Agent runner started");

		const channelConfigs = this.config.channelConfigs;
		if (!channelConfigs) {
			this.logger.info("No channel configs — running without channels");
			return;
		}

		// Wrap legacy telegramToken config into channelConfigs for unified handling
		if (!channelConfigs.telegram && this.config.telegramToken) {
			(channelConfigs as Record<string, unknown>).telegram = {
				token: this.config.telegramToken,
				webhookUrl: this.config.telegramWebhookUrl,
			};
		}

		await this.startAllChannels(channelConfigs);
		this.logger.info("All channels started");
	}

	async stop(): Promise<void> {
		if (!this.running) return;
		this.running = false;
		const promises: Array<Promise<void>> = [];
		for (const ch of this.activeChannels) promises.push(ch.disconnect());
		await Promise.allSettled(promises);
		this.activeChannels.clear();
		this.sessions.clear();
		this.logger.info("Agent runner stopped");
	}

	get isRunning(): boolean {
		return this.running;
	}

	// ── Channel Wiring ──────────────────────────────────────────────────────

	/**
	 * Wire a generic channel via Duck-typed interface.
	 * All channel start methods delegate to this for consistent lifecycle:
	 *   onMessage → handleMessage → sendResponse
	 *   connect (awaited)
	 *   disconnect on stop
	 *
	 * Each channel has unique message/send option types, so the interface
	 * pragmatically uses `any` for message and options.
	 */
	private async wireChannel(
		channel: {
			onMessage: (handler: (msg: any) => Promise<void>) => void;
			connect: () => Promise<void>;
			disconnect: () => Promise<void>;
			sendMessage: (options: any) => Promise<unknown>;
		},
		channelName: string,
		getChatId: (msg: any) => string,
	): Promise<void> {
		this.activeChannels.add(channel as { disconnect: () => Promise<void> });
		channel.onMessage(async (msg: any) => {
			const content = String(msg.text ?? msg.content ?? "");
			if (!content) return;
			const chatId = getChatId(msg);
			await this.handleMessage(
				content,
				`${channelName}:${chatId}`,
				async (text) => {
					try {
						await channel.sendMessage({ text, content: text });
					} catch (err: unknown) {
						this.logger.error(`${channelName} send error`, {
							error: err instanceof Error ? err.message : "send failed",
						});
					}
				},
			);
		});
		await channel.connect();
		this.logger.info(`${channelName} channel started`);
	}

	/** Channel descriptor for consolidated dynamic import + wiring */
	private static readonly CHANNEL_REGISTRY: Array<{
		key: keyof ChannelConfigs;
		name: string;
		path: string;
		className: string;
		getChatId: (msg: any) => string;
	}> = [
		{
			key: "telegram",
			name: "telegram",
			path: "../channels/telegram/channel.js",
			className: "TelegramChannel",
			getChatId: (m) => String(m.chatId ?? m.fromId ?? "unknown"),
		},
		{
			key: "discord",
			name: "discord",
			path: "../channels/discord/channel.js",
			className: "DiscordChannel",
			getChatId: (m) => String(m.channelId ?? m.fromId ?? "unknown"),
		},
		{
			key: "slack",
			name: "slack",
			path: "../channels/slack/channel.js",
			className: "SlackChannel",
			getChatId: (m) => String(m.channel ?? m.user ?? "unknown"),
		},
		{
			key: "matrix",
			name: "matrix",
			path: "../channels/matrix/channel.js",
			className: "MatrixChannel",
			getChatId: (m) => String(m.roomId ?? m.sender ?? "unknown"),
		},
		{
			key: "feishu",
			name: "feishu",
			path: "../channels/feishu/channel.js",
			className: "FeishuChannel",
			getChatId: (m) => String(m.chatId ?? m.sender?.id ?? "unknown"),
		},
		{
			key: "wecom",
			name: "wecom",
			path: "../channels/wecom/channel.js",
			className: "WeComChannel",
			getChatId: (m) => String(m.chatId ?? m.from ?? "unknown"),
		},
		{
			key: "qq",
			name: "qq",
			path: "../channels/qq/channel.js",
			className: "QQChannel",
			getChatId: (m) => String(m.groupId ?? m.userId ?? "unknown"),
		},
		{
			key: "dingtalk",
			name: "dingtalk",
			path: "../channels/dingtalk/channel.js",
			className: "DingTalkChannel",
			getChatId: (m) => String(m.chatId ?? m.senderId ?? "unknown"),
		},
		{
			key: "email",
			name: "email",
			path: "../channels/email/channel.js",
			className: "EmailChannel",
			getChatId: (m) => String(m.from ?? m.content ?? "unknown"),
		},
		{
			key: "teams",
			name: "teams",
			path: "../channels/teams/channel.js",
			className: "TeamsChannel",
			getChatId: (m) => String(m.conversation?.id ?? m.from?.id ?? "unknown"),
		},
		{
			key: "whatsapp",
			name: "whatsapp",
			path: "../channels/whatsapp/channel.js",
			className: "WhatsAppChannel",
			getChatId: (m) => String(m.from ?? m.phoneNumber ?? "unknown"),
		},
		{
			key: "websocket",
			name: "websocket",
			path: "../channels/websocket/channel.js",
			className: "WebSocketChannel",
			getChatId: (m) => String(m.sessionId ?? m.clientId ?? "unknown"),
		},
		{
			key: "wechat",
			name: "wechat",
			path: "../channels/wechat/channel.js",
			className: "WeChatChannel",
			getChatId: (m) => String(m.userId ?? m.msgId ?? "unknown"),
		},
	];

	/**
	 * Start a single channel from the registry.
	 * Dynamically imports the module, instantiates the channel class,
	 * and wires it through the lifecycle.
	 */
	private async startSingleChannel(
		channelConfig: unknown,
		descriptor: (typeof AgentRunner.CHANNEL_REGISTRY)[number],
	): Promise<void> {
		const mod = await import(descriptor.path);
		const ChannelClass = mod[descriptor.className] as new (
			config: any,
		) => {
			onMessage: (handler: (msg: any) => Promise<void>) => void;
			connect: () => Promise<void>;
			disconnect: () => Promise<void>;
			sendMessage: (options: any) => Promise<unknown>;
		};
		await this.wireChannel(
			new ChannelClass(channelConfig),
			descriptor.name,
			descriptor.getChatId,
		);
	}

	/**
	 * Start all configured channels from the registry.
	 * Iterates the registry and starts each channel whose config is present.
	 */
	private async startAllChannels(
		channelConfigs: ChannelConfigs,
	): Promise<void> {
		const promises: Array<Promise<void>> = [];
		for (const desc of AgentRunner.CHANNEL_REGISTRY) {
			const cfg = channelConfigs[desc.key];
			if (cfg) {
				promises.push(this.startSingleChannel(cfg, desc));
			}
		}
		await Promise.all(promises);
	}

	// ── Legacy API ─────────────────────────────────────────────────────────

	async processMessage(
		content: string,
		conversationId?: string,
	): Promise<string> {
		if (!this.running || this.providers.length === 0) {
			return "Agent is not running or no provider configured.";
		}
		const session = this.getOrCreateSession(conversationId ?? "cli:default");
		if (!session) return "No LLM provider is configured.";
		try {
			const result = await session.processMessage(
				content,
				conversationId ?? "cli:default",
			);
			return result.response;
		} catch (err: unknown) {
			return err instanceof Error ? err.message : "Unknown error";
		}
	}
}

export function createAgentRunnerFromEnv(): AgentRunner {
	return new AgentRunner({
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
	});
}
