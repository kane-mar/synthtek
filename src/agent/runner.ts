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

		const promises: Array<Promise<void>> = [];

		// Prefer channelConfigs over legacy telegramToken config
		if (channelConfigs.telegram) {
			promises.push(this.startTelegram(channelConfigs.telegram));
		} else if (this.config.telegramToken) {
			promises.push(
				this.startTelegram({
					token: this.config.telegramToken,
					webhookUrl: this.config.telegramWebhookUrl,
				}),
			);
		}
		if (channelConfigs.discord)
			promises.push(this.startDiscord(channelConfigs.discord));
		if (channelConfigs.slack)
			promises.push(this.startSlack(channelConfigs.slack));
		if (channelConfigs.matrix)
			promises.push(this.startMatrix(channelConfigs.matrix));
		if (channelConfigs.feishu)
			promises.push(this.startFeishu(channelConfigs.feishu));
		if (channelConfigs.wecom)
			promises.push(this.startWeCom(channelConfigs.wecom));
		if (channelConfigs.qq) promises.push(this.startQQ(channelConfigs.qq));
		if (channelConfigs.dingtalk)
			promises.push(this.startDingTalk(channelConfigs.dingtalk));
		if (channelConfigs.email)
			promises.push(this.startEmail(channelConfigs.email));
		if (channelConfigs.teams)
			promises.push(this.startTeams(channelConfigs.teams));
		if (channelConfigs.whatsapp)
			promises.push(this.startWhatsApp(channelConfigs.whatsapp));
		if (channelConfigs.websocket)
			promises.push(this.startWebSocket(channelConfigs.websocket));
		if (channelConfigs.wechat)
			promises.push(this.startWeChat(channelConfigs.wechat));

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
	 * Wire a generic channel via Duck-typed interface.
	 * All 14 channel start methods delegate to this for consistent lifecycle:
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

	private async startTelegram(
		config: NonNullable<ChannelConfigs["telegram"]>,
	): Promise<void> {
		const { TelegramChannel } = await import("../channels/telegram/channel.js");
		await this.wireChannel(new TelegramChannel(config), "telegram", (m) =>
			String(m.chatId ?? m.fromId ?? "unknown"),
		);
	}

	private async startDiscord(
		config: NonNullable<ChannelConfigs["discord"]>,
	): Promise<void> {
		const { DiscordChannel } = await import("../channels/discord/channel.js");
		await this.wireChannel(new DiscordChannel(config), "discord", (m) =>
			String(m.channelId ?? m.fromId ?? "unknown"),
		);
	}

	private async startSlack(
		config: NonNullable<ChannelConfigs["slack"]>,
	): Promise<void> {
		const { SlackChannel } = await import("../channels/slack/channel.js");
		await this.wireChannel(new SlackChannel(config), "slack", (m) =>
			String(m.channel ?? m.user ?? "unknown"),
		);
	}

	private async startMatrix(
		config: NonNullable<ChannelConfigs["matrix"]>,
	): Promise<void> {
		const { MatrixChannel } = await import("../channels/matrix/channel.js");
		await this.wireChannel(new MatrixChannel(config), "matrix", (m) =>
			String(m.roomId ?? m.sender ?? "unknown"),
		);
	}

	private async startFeishu(
		config: NonNullable<ChannelConfigs["feishu"]>,
	): Promise<void> {
		const { FeishuChannel } = await import("../channels/feishu/channel.js");
		await this.wireChannel(new FeishuChannel(config), "feishu", (m) =>
			String(m.chatId ?? m.sender?.id ?? "unknown"),
		);
	}

	private async startWeCom(
		config: NonNullable<ChannelConfigs["wecom"]>,
	): Promise<void> {
		const { WeComChannel } = await import("../channels/wecom/channel.js");
		await this.wireChannel(new WeComChannel(config), "wecom", (m) =>
			String(m.chatId ?? m.from ?? "unknown"),
		);
	}

	private async startQQ(
		config: NonNullable<ChannelConfigs["qq"]>,
	): Promise<void> {
		const { QQChannel } = await import("../channels/qq/channel.js");
		await this.wireChannel(new QQChannel(config), "qq", (m) =>
			String(m.groupId ?? m.userId ?? "unknown"),
		);
	}

	private async startDingTalk(
		config: NonNullable<ChannelConfigs["dingtalk"]>,
	): Promise<void> {
		const { DingTalkChannel } = await import("../channels/dingtalk/channel.js");
		await this.wireChannel(new DingTalkChannel(config), "dingtalk", (m) =>
			String(m.chatId ?? m.senderId ?? "unknown"),
		);
	}

	private async startEmail(
		config: NonNullable<ChannelConfigs["email"]>,
	): Promise<void> {
		const { EmailChannel } = await import("../channels/email/channel.js");
		await this.wireChannel(new EmailChannel(config), "email", (m) =>
			String(m.from ?? m.content ?? "unknown"),
		);
	}

	private async startTeams(
		config: NonNullable<ChannelConfigs["teams"]>,
	): Promise<void> {
		const { TeamsChannel } = await import("../channels/teams/channel.js");
		await this.wireChannel(new TeamsChannel(config), "teams", (m) =>
			String(m.conversation?.id ?? m.from?.id ?? "unknown"),
		);
	}

	private async startWhatsApp(
		config: NonNullable<ChannelConfigs["whatsapp"]>,
	): Promise<void> {
		const { WhatsAppChannel } = await import("../channels/whatsapp/channel.js");
		await this.wireChannel(new WhatsAppChannel(config), "whatsapp", (m) =>
			String(m.from ?? m.phoneNumber ?? "unknown"),
		);
	}

	private async startWebSocket(
		config: NonNullable<ChannelConfigs["websocket"]>,
	): Promise<void> {
		const { WebSocketChannel } = await import(
			"../channels/websocket/channel.js"
		);
		await this.wireChannel(new WebSocketChannel(config), "websocket", (m) =>
			String(m.sessionId ?? m.clientId ?? "unknown"),
		);
	}

	private async startWeChat(
		config: NonNullable<ChannelConfigs["wechat"]>,
	): Promise<void> {
		const { WeChatChannel } = await import("../channels/wechat/channel.js");
		await this.wireChannel(new WeChatChannel(config), "wechat", (m) =>
			String(m.userId ?? m.msgId ?? "unknown"),
		);
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
