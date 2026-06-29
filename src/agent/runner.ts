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

import { getSystemPrompt } from "../config/agent-config.js";
import { SimpleLogger } from "../core/logger.js";
import { AgentSession } from "./session.js";
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
			const providerType = config.provider as import("../providers/types.js").ProviderType;
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

	// ── Session Management ──────────────────────────────────────────────────

	private getOrCreateSession(conversationId: string): AgentSession | null {
		const provider = this.providers[0];
		if (!provider) return null;
		let session = this.sessions.get(conversationId);
		if (!session) {
			// Read agent parameters from shared config
			const { getAgentConfig } = require("../config/agent-config.js");
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
			this.logger.debug(`Created session for ${conversationId} (maxToolCalls=${agentCfg.maxToolCalls}, temp=${agentCfg.temperature})`);
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

		const promises: Array<Promise<void>> = [];

		if (this.config.telegramToken) {
			promises.push(this.startTelegram({ token: this.config.telegramToken, webhookUrl: this.config.telegramWebhookUrl }));
		}
		if (channelConfigs.telegram) promises.push(this.startTelegram(channelConfigs.telegram as any));
		if (channelConfigs.discord) promises.push(this.startDiscord(channelConfigs.discord as any));
		if (channelConfigs.slack) promises.push(this.startSlack(channelConfigs.slack as any));
		if (channelConfigs.matrix) promises.push(this.startMatrix(channelConfigs.matrix as any));
		if (channelConfigs.feishu) promises.push(this.startFeishu(channelConfigs.feishu as any));
		if (channelConfigs.wecom) promises.push(this.startWeCom(channelConfigs.wecom as any));
		if (channelConfigs.qq) promises.push(this.startQQ(channelConfigs.qq as any));
		if (channelConfigs.dingtalk) promises.push(this.startDingTalk(channelConfigs.dingtalk as any));
		if (channelConfigs.email) promises.push(this.startEmail(channelConfigs.email as any));
		if (channelConfigs.teams) promises.push(this.startTeams(channelConfigs.teams as any));
		if (channelConfigs.whatsapp) promises.push(this.startWhatsApp(channelConfigs.whatsapp as any));
		if (channelConfigs.websocket) promises.push(this.startWebSocket(channelConfigs.websocket as any));

		await Promise.all(promises);
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
	 * Wire a generic channel using duck-typed interface.
	 * Each channel gets its own conversation ID derived from channelName + chat ID.
	 */
	private wireChannel(
		channel: {
			onMessage: (handler: (msg: any) => Promise<void>) => void;
			connect: () => Promise<void>;
			disconnect: () => Promise<void>;
			sendMessage: (options: any) => Promise<unknown>;
		},
		channelName: string,
		getChatId: (msg: any) => string,
	): void {
		this.activeChannels.add(channel as { disconnect: () => Promise<void> });
		channel.onMessage(async (msg: any) => {
			const content = String(msg.text ?? msg.content ?? "");
			if (!content) return;
			const chatId = getChatId(msg);
			await this.handleMessage(content, `${channelName}:${chatId}`, async (text) => {
				try {
					await channel.sendMessage({ text, content: text, body: text });
				} catch (err: unknown) {
					this.logger.error(`${channelName} send error`, {
						error: err instanceof Error ? err.message : "send failed",
					});
				}
			});
		});
		channel.connect().catch((err: unknown) => {
			this.logger.error(`${channelName} connection failed`, {
				error: err instanceof Error ? err.message : "connect failed",
			});
		});
		this.logger.info(`${channelName} channel wired`);
	}

	private async startTelegram(config: { token: string; webhookUrl?: string }): Promise<void> {
		const { TelegramChannel } = await import("../channels/telegram/channel.js");
		const channel = new TelegramChannel(config as any);
		this.activeChannels.add(channel);
		channel.onMessage(async (msg: any) => {
			const text = msg.text ?? "";
			if (!text) return;
			const chatId = msg.chatId ?? msg.fromId ?? "unknown";
			await this.handleMessage(text, `telegram:${chatId}`, async (response) => {
				await channel.sendMessage({ chatId: String(chatId), text: response });
			});
		});
		await channel.connect();
		this.logger.info("telegram channel started");
	}

	private async startDiscord(config: any): Promise<void> {
		const { DiscordChannel } = await import("../channels/discord/channel.js");
		const channel = new DiscordChannel(config);
		this.activeChannels.add(channel);
		channel.onMessage(async (msg: any) => {
			const content = msg.text ?? "";
			if (!content) return;
			await this.handleMessage(content, `discord:${msg.channelId ?? msg.fromId ?? "unknown"}`, async (text) => {
				await channel.sendMessage({ channelId: msg.channelId, text });
			});
		});
		await channel.connect();
		this.logger.info("discord channel started");
	}

	private async startEmail(config: any): Promise<void> {
		const { EmailChannel } = await import("../channels/email/channel.js");
		const channel = new EmailChannel(config);
		this.activeChannels.add(channel);
		channel.onMessage(async (msg: any) => {
			const content = msg.text ?? msg.content ?? "";
			if (!content) return;
			await this.handleMessage(content, `email:${msg.from ?? "unknown"}`, async (text) => {
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

	private async startSlack(config: any): Promise<void> {
		const { SlackChannel } = await import("../channels/slack/channel.js");
		this.wireChannel(new SlackChannel(config), "slack", (m) => m.channel ?? m.user ?? "unknown");
	}

	private async startMatrix(config: any): Promise<void> {
		const { MatrixChannel } = await import("../channels/matrix/channel.js");
		this.wireChannel(new MatrixChannel(config), "matrix", (m) => m.roomId ?? m.sender ?? "unknown");
	}

	private async startFeishu(config: any): Promise<void> {
		const { FeishuChannel } = await import("../channels/feishu/channel.js");
		this.wireChannel(new FeishuChannel(config), "feishu", (m) => m.chatId ?? m.sender?.id ?? "unknown");
	}

	private async startWeCom(config: any): Promise<void> {
		const { WeComChannel } = await import("../channels/wecom/channel.js");
		this.wireChannel(new WeComChannel(config), "wecom", (m) => m.chatId ?? m.from ?? "unknown");
	}

	private async startQQ(config: any): Promise<void> {
		const { QQChannel } = await import("../channels/qq/channel.js");
		this.wireChannel(new QQChannel(config), "qq", (m) => m.groupId ?? m.userId ?? "unknown");
	}

	private async startDingTalk(config: any): Promise<void> {
		const { DingTalkChannel } = await import("../channels/dingtalk/channel.js");
		this.wireChannel(new DingTalkChannel(config), "dingtalk", (m) => m.chatId ?? m.senderId ?? "unknown");
	}

	private async startTeams(config: any): Promise<void> {
		const { TeamsChannel } = await import("../channels/teams/channel.js");
		this.wireChannel(new TeamsChannel(config), "teams", (m) => m.conversation?.id ?? m.from?.id ?? "unknown");
	}

	private async startWhatsApp(config: any): Promise<void> {
		const { WhatsAppChannel } = await import("../channels/whatsapp/channel.js");
		this.wireChannel(new WhatsAppChannel(config), "whatsapp", (m) => m.from ?? m.phoneNumber ?? "unknown");
	}

	private async startWebSocket(_config: any): Promise<void> {
		this.logger.info("WebSocket channel configured (start pending implementation)");
	}

	// ── Legacy API ─────────────────────────────────────────────────────────

	async processMessage(content: string, conversationId?: string): Promise<string> {
		if (!this.running || this.providers.length === 0) {
			return "Agent is not running or no provider configured.";
		}
		const session = this.getOrCreateSession(conversationId ?? "cli:default");
		if (!session) return "No LLM provider is configured.";
		try {
			const result = await session.processMessage(content, conversationId ?? "cli:default");
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
		logLevel: (process.env.SYNTHTEK_LOG_LEVEL as any) ?? "info",
	});
}
