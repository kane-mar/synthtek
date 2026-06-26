/**
 * Discord Channel — Discord.js integration for synthtek
 */

import {
	ActionRowBuilder,
	type APIApplicationCommand,
	type ApplicationCommandOptionType,
	ApplicationCommandType,
	AttachmentBuilder,
	ButtonBuilder,
	type ButtonStyle,
	ChannelType,
	Client,
	type DMChannel,
	EmbedBuilder,
	type ForumChannel,
	GatewayIntentBits,
	type MediaChannel,
	MessageFlags,
	type NewsChannel,
	Partials,
	PermissionsBitField,
	REST,
	Routes,
	type StageChannel,
	StringSelectMenuBuilder,
	type TextChannel,
	type ThreadChannel,
	type VoiceChannel,
} from "discord.js";

import { BaseChannel } from "../base-channel.js";

import type {
	DiscordChannelInfo,
	DiscordConfig,
	DiscordEmbed,
	DiscordGuildInfo,
	DiscordMessage,
	DiscordOutboundMessage,
	DiscordPermission,
	DiscordReaction,
	DiscordSendOptions,
	DiscordSlashCommand,
	DiscordStats,
	DiscordStreamBuffer,
	DiscordUserInfo,
} from "./types.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a Discord message to our unified format */
function parseMessage(msg: any): DiscordMessage {
	return {
		messageId: msg.id,
		channelId: msg.channelId,
		guildId: msg.guild?.id,
		fromId: msg.author.id,
		fromUsername: msg.author.username,
		fromDiscriminator:
			msg.author.discriminator !== "0" ? msg.author.discriminator : undefined,
		text: msg.content,
		isEdited: msg.editedAt !== null,
		createdAt: msg.createdTimestamp,
		updatedAt: msg.editedAt?.getTime(),
		attachments:
			msg.attachments?.map((a: any) => ({
				id: a.id,
				filename: a.name,
				size: a.size,
				url: a.url,
				contentType: a.contentType ?? "",
			})) ?? [],
		embeds:
			msg.embeds?.map((e: any) => ({
				title: e.title,
				description: e.description,
				url: e.url,
				color: e.color,
				footer: e.footer
					? { text: e.footer.text, iconUrl: e.footer.iconURL ?? undefined }
					: undefined,
				author: e.author
					? { name: e.author.name, iconURL: e.author.iconURL ?? undefined }
					: undefined,
			})) ?? [],
		mentionedUserIds: msg.mentions?.users?.map((u: any) => u.id) ?? [],
		mentionedRoleIds: msg.mentions?.roles?.map((r: any) => r.id) ?? [],
		channelType: msg.channel?.type ?? 0,
		messageType: msg.type ?? 0,
		hasComponents: (msg.components?.size ?? 0) > 0,
		emoji:
			msg.content?.match(/<a?:\w+:(\d+)>/g)?.map((emoji: string) => {
				const match = emoji.match(/:(\w+):(\d+)>/);
				return {
					name: match?.[1] ?? "",
					id: match?.[2] ?? "",
					animated: emoji.startsWith("<a:"),
				};
			}) ?? [],
		reactionCount: msg.reactions?.cache?.size ?? 0,
		threadId: msg.in?.thread?.id,
		isSystem: msg.system ?? false,
	};
}

/** Build a Discord Embed from our embed type */
function buildEmbed(embed: DiscordEmbed): EmbedBuilder {
	const builder = new EmbedBuilder();

	if (embed.title) builder.setTitle(embed.title);
	if (embed.description) builder.setDescription(embed.description);
	if (embed.url) builder.setURL(embed.url);
	if (embed.color !== undefined) builder.setColor(embed.color);
	if (embed.footer)
		builder.setFooter({
			text: embed.footer.text,
			iconURL: embed.footer.iconUrl,
		});
	if (embed.image) builder.setImage(embed.image.url);
	if (embed.thumbnail) builder.setThumbnail(embed.thumbnail.url);
	if (embed.author)
		builder.setAuthor({
			name: embed.author.name,
			iconURL: embed.author.iconUrl,
		});
	if (embed.fields) builder.addFields(embed.fields);
	if (embed.timestamp) builder.setTimestamp(embed.timestamp);

	return builder;
}

// ─── Discord Channel ─────────────────────────────────────────────────────────

const DISCORD_MAX_MESSAGE_LEN = 2000;
const STREAM_EDIT_INTERVAL_MS = 600;
const TYPING_INTERVAL_MS = 8000;

export class DiscordChannel extends BaseChannel<DiscordConfig, DiscordMessage> {
	private client: Client;
	protected config: Required<DiscordConfig>;
	private botUser: any;
	private reconnectAttempts = 0;
	private presenceInterval: ReturnType<typeof setInterval> | undefined;

	// Advanced state
	private streamBuffers = new Map<string, DiscordStreamBuffer>();
	private typingIntervals = new Map<string, ReturnType<typeof setInterval>>();
	private mediaSent = 0;

	constructor(config: DiscordConfig) {
		super(config);
		const defaultConfig = {
			clientId: "",
			guildIds: [] as string[],
			intents: [] as string[],
			reconnectDelay: 5000,
			maxReconnectAttempts: 0,
			presenceInterval: 0,
			adminIds: [] as string[],
			slashCommands: true,
			reactions: true,
			reactEmoji: "👀",
			maxMessageLength: DISCORD_MAX_MESSAGE_LEN,
			typingInterval: TYPING_INTERVAL_MS,
			downloadMedia: true,
			mediaDir: "./media",
			presence: true,
			presenceActivity: "synthtek",
			presenceStatus: "online" as const,
		};

		this.config = { ...defaultConfig, ...config };

		const intents = (
			this.config.intents.length > 0
				? this.config.intents
				: [
						"Guilds",
						"GuildMessages",
						"GuildMembers",
						"MessageContent",
						"GuildMessageReactions",
					]
		).map((i) => {
			const bit = GatewayIntentBits[i as keyof typeof GatewayIntentBits];
			if (!bit) {
				console.warn(`[Discord] Unknown intent "${i}", falling back to Guilds`);
				return GatewayIntentBits.Guilds;
			}
			return bit;
		});

		const partials = [
			Partials.Channel,
			Partials.GuildMember,
			Partials.Message,
			Partials.Reaction,
		];

		this.client = new Client({ intents, partials });

		this.setupEventHandlers();
	}

	/** Set up Discord event handlers */
	private setupEventHandlers(): void {
		this.client.on("ready", () => {
			this.botUser = this.client.user;
			this.reconnectAttempts = 0;
			console.log(`[Discord] Logged in as ${this.botUser.tag}`);

			// Set presence
			if (this.config.presence) {
				this.setPresence();
			}

			// Register slash commands
			if (this.config.slashCommands) {
				this.registerSlashCommands();
			}

			if (this.config.presenceInterval > 0) {
				this.startPresence();
			}
		});

		this.client.on("messageCreate", (msg: any) => {
			if (msg.author?.bot) return;
			if (
				this.config.guildIds.length > 0 &&
				msg.guildId &&
				!this.config.guildIds.includes(msg.guildId)
			) {
				return;
			}
			if (msg.type !== 0 && msg.type !== 7 && msg.type !== 19) return;
			const parsed = parseMessage(msg);
			this.recordReceived();

			// Start typing indicator
			this.sendTypingWithAutoRefresh(msg.channelId);

			// React with configured emoji
			if (this.config.reactions) {
				try {
					msg.react(this.config.reactEmoji).catch(() => {});
				} catch {
					// Ignore reaction errors
				}
			}

			if (parsed.text.trim()) {
				this.dispatchMessage(parsed);
			}
		});

		this.client.on("messageUpdate", (_oldMsg: any, newMsg: any) => {
			if (newMsg.author?.bot) return;
			if (
				this.config.guildIds.length > 0 &&
				newMsg.guildId &&
				!this.config.guildIds.includes(newMsg.guildId)
			) {
				return;
			}
			const parsed = parseMessage(newMsg);
			parsed.isEdited = true;
			this.dispatchMessage(parsed);
		});

		// Handle interaction commands (slash commands)
		this.client.on("interactionCreate", async (interaction: any) => {
			if (!interaction.isCommand()) return;

			const command = interaction.commandName;
			const userId = interaction.user?.id;

			// Check admin-only commands
			if (this.isAdminCommand(command) && !this.isAdmin(userId)) {
				await interaction.reply({
					content: "❌ You do not have permission to use this command.",
					ephemeral: true,
				});
				return;
			}

			// Forward to message handler
			this.dispatchMessage({
					messageId: interaction.id,
					channelId: interaction.channelId,
					guildId: interaction.guildId,
					fromId: userId,
					fromUsername: interaction.user?.username ?? "unknown",
					text: `/${command} ${interaction.options?.getString("query") ?? ""}`,
					isEdited: false,
					createdAt: Date.now(),
					attachments: [],
					embeds: [],
					mentionedUserIds: [],
					mentionedRoleIds: [],
					channelType: interaction.channel?.type ?? 0,
					messageType: 0,
					hasComponents: false,
					emoji: [],
					reactionCount: 0,
					isSystem: false,
				});
		});

		// Handle button interactions
		this.client.on("interactionCreate", async (interaction: any) => {
			if (!interaction.isButton()) return;

			const customId = interaction.customId;
			this.dispatchMessage({
					messageId: interaction.id,
					channelId: interaction.channelId,
					guildId: interaction.guildId,
					fromId: interaction.user?.id,
					fromUsername: interaction.user?.username ?? "unknown",
					text: `button:${customId}`,
					isEdited: false,
					createdAt: Date.now(),
					attachments: [],
					embeds: [],
					mentionedUserIds: [],
					mentionedRoleIds: [],
					channelType: interaction.channel?.type ?? 0,
					messageType: 0,
					hasComponents: false,
					emoji: [],
					reactionCount: 0,
					isSystem: false,
				});
		});

		this.client.on("error", (error: Error) => {
			this.emitError(error);
		});

		this.client.on("disconnect", () => {
			if (
				this.config.maxReconnectAttempts === 0 ||
				this.reconnectAttempts < this.config.maxReconnectAttempts
			) {
				this.reconnectAttempts++;
				console.log(
					`[Discord] Disconnected. Reconnecting in ${this.config.reconnectDelay}ms (attempt ${this.reconnectAttempts})`,
				);
				setTimeout(() => {
					if (this.isConnected()) {
						this.client.login(this.config.token).catch((err: Error) => {
							this.emitError(err);
						});
					}
				}, this.config.reconnectDelay);
			} else {
				console.error("[Discord] Max reconnection attempts reached. Stopping.");
			}
		});
	}

	/** Check if a command is admin-only */
	private isAdminCommand(command: string): boolean {
		const adminCommands = [
			"stop",
			"restart",
			"status",
			"dream",
			"dream_log",
			"dream_restore",
		];
		return adminCommands.includes(command);
	}

	/** Check if a user is an admin */
	private isAdmin(userId: string | undefined): boolean {
		if (!userId) return false;
		return this.config.adminIds.includes(userId);
	}

	/** Register slash commands */
	private async registerSlashCommands(): Promise<void> {
		try {
			const commands: DiscordSlashCommand[] = [
				{ name: "start", description: "Start the bot" },
				{ name: "new", description: "Start a new conversation" },
				{ name: "stop", description: "Stop the current task" },
				{ name: "restart", description: "Restart the bot" },
				{ name: "status", description: "Show bot status" },
				{ name: "dream", description: "Run Dream memory consolidation now" },
				{
					name: "dream_log",
					description: "Show the latest Dream memory change",
				},
				{
					name: "dream_restore",
					description: "Restore Dream memory to an earlier version",
				},
				{ name: "help", description: "Show available commands" },
			];

			const rest = new REST({ version: "10" }).setToken(this.config.token);

			if (this.config.clientId) {
				await rest.put(Routes.applicationCommands(this.config.clientId), {
					body: commands.map((cmd) => ({
						name: cmd.name,
						description: cmd.description,
						type: ApplicationCommandType.ChatInput,
					})),
				});
				console.log("[Discord] Slash commands registered globally");
			}
		} catch (error) {
			console.warn("[Discord] Failed to register slash commands:", error);
		}
	}

	/** Set bot presence */
	private setPresence(): void {
		if (!this.client.user) return;

		this.client.user.setPresence({
			status: this.config.presenceStatus as import("discord.js").ClientPresenceStatus,
			activities: [
				{
					name: this.config.presenceActivity,
					type: 0, // Playing
				},
			],
		});
	}

	/** Start the Discord bot */
	async start(
		onMessage: (message: DiscordMessage) => void | Promise<void>,
		onError?: (error: Error) => void,
	): Promise<void> {
		this.onMessage(async (msg) => {
			await onMessage(msg);
		});
		if (onError) this.onError(event => onError(event.error));
		await this.client.login(this.config.token);
	}

	/** Connect to Discord — logs in the client */
	async connect(): Promise<void> {
		await this.client.login(this.config.token);
	}

	/** Backward-compat stop — delegates to disconnect */
	async stop(): Promise<void> {
		await this.disconnect();
	}

	/** Disconnect from Discord */
	async disconnect(): Promise<void> {
		// Cancel all typing indicators
		for (const interval of this.typingIntervals.values()) {
			clearInterval(interval);
		}
		this.typingIntervals.clear();

		if (this.presenceInterval) {
			clearInterval(this.presenceInterval);
			this.presenceInterval = undefined;
		}
		await this.client.destroy();
	}

	// ─── Streaming ───────────────────────────────────────────────────────────

	/** Start a streaming session for a channel */
	startStream(channelId: string, messageId: string, streamId: string): void {
		this.streamBuffers.set(channelId, {
			text: "",
			messageId,
			lastEdit: Date.now(),
			streamId,
		});
	}

	/** Push text to a streaming session (progressive editing) */
	async pushStreamText(channelId: string, text: string): Promise<void> {
		const buf = this.streamBuffers.get(channelId);
		if (!buf?.messageId) return;

		buf.text += text;
		const now = Date.now();

		// Only edit if enough time has passed since last edit
		if (now - buf.lastEdit >= STREAM_EDIT_INTERVAL_MS) {
			try {
				const ch = await this.getChannel(channelId);
				if (ch) {
					const msg = await (ch as any).messages.fetch(buf.messageId);
					await msg.edit({ content: buf.text });
					buf.lastEdit = now;
				}
			} catch {
				// Ignore edit errors during streaming
			}
		}
	}

	/** Finalize a streaming session */
	async finalizeStream(channelId: string): Promise<void> {
		const buf = this.streamBuffers.get(channelId);
		if (!buf?.messageId) return;

		// Final edit to ensure complete text is shown
		try {
			const ch = await this.getChannel(channelId);
			if (ch) {
				const msg = await (ch as any).messages.fetch(buf.messageId);
				await msg.edit({ content: buf.text });
			}
		} catch {
			// Ignore final edit errors
		}

		this.streamBuffers.delete(channelId);
	}

	/** Cancel a streaming session */
	cancelStream(channelId: string): void {
		this.streamBuffers.delete(channelId);
	}

	/** Get active stream count */
	getActiveStreamCount(): number {
		return this.streamBuffers.size;
	}

	// ─── Typing with Auto-Refresh ────────────────────────────────────────────

	/** Send typing indicator with auto-refresh */
	async sendTypingWithAutoRefresh(channelId: string): Promise<void> {
		// Clear previous typing interval for this channel
		this.stopTyping(channelId);

		try {
			await this.sendTyping(channelId);
		} catch {
			// Ignore typing errors
		}

		// Set up auto-refresh interval
		const interval = setInterval(async () => {
			try {
				await this.sendTyping(channelId);
			} catch {
				this.stopTyping(channelId);
			}
		}, this.config.typingInterval);
		this.typingIntervals.set(channelId, interval);
	}

	/** Stop typing indicator for a channel */
	stopTyping(channelId: string): void {
		const interval = this.typingIntervals.get(channelId);
		if (interval) {
			clearInterval(interval);
			this.typingIntervals.delete(channelId);
		}
	}

	// ─── Outbound Messages ───────────────────────────────────────────────────

	/** Send an outbound message (integration with agent loop) */
	async sendOutboundMessage(msg: DiscordOutboundMessage): Promise<void> {
		if (!this.isConnected()) {
			console.warn("[Discord] Bot not running");
			return;
		}

		// Only stop typing indicator for final responses
		if (!msg.metadata._progress) {
			this.stopTyping(msg.channelId);
		}

		const ch = await this.getChannel(msg.channelId);
		if (!ch) {
			console.error(`[Discord] Channel ${msg.channelId} not found`);
			return;
		}

		// Send media files
		for (const mediaPath of msg.media ?? []) {
			try {
				const [ok, error] = this.validateUrlTarget(mediaPath);
				if (!ok) {
					throw new Error(`unsafe media URL: ${error}`);
				}

				const attachment = new AttachmentBuilder(mediaPath);
				await (ch as any).send({ files: [attachment] });
				this.mediaSent++;
			} catch (error) {
				const filename = mediaPath.split("/").pop() ?? mediaPath;
				console.error(`[Discord] Failed to send media ${mediaPath}:`, error);
				await (ch as any).send({ content: `[Failed to send: ${filename}]` });
			}
		}

		// Send text content
		if (msg.content && msg.content !== "[empty message]") {
			for (const chunk of this.splitMessage(msg.content)) {
				try {
					await (ch as any).send({ content: chunk });
					this.recordSent();
				} catch (error) {
					console.error("[Discord] Failed to send message:", error);
				}
			}
		}
	}

	/** Validate a URL target for safety */
	private validateUrlTarget(url: string): [boolean, string] {
		try {
			const parsed = new URL(url);
			if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
				return [false, "invalid protocol"];
			}
			const blockedHosts = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];
			if (blockedHosts.includes(parsed.hostname)) {
				return [false, "blocked host"];
			}
			return [true, ""];
		} catch {
			return [false, "invalid URL"];
		}
	}

	/** Split message into chunks that fit Discord's limit */
	private splitMessage(text: string): string[] {
		const maxLength = this.config.maxMessageLength;
		if (text.length <= maxLength) return [text];

		const chunks: string[] = [];
		let current = "";

		const paragraphs = text.split("\n");
		for (const paragraph of paragraphs) {
			if ((current + paragraph).length <= maxLength) {
				current += (current ? "\n" : "") + paragraph;
			} else {
				if (current) chunks.push(current);
				if (paragraph.length > maxLength) {
					let remaining = paragraph;
					while (remaining.length > 0) {
						chunks.push(remaining.slice(0, maxLength));
						remaining = remaining.slice(maxLength);
					}
				} else {
					current = paragraph;
				}
			}
		}

		if (current) chunks.push(current);
		return chunks;
	}

	// ─── Stats ───────────────────────────────────────────────────────────────

	/** Get client stats */
	getStats(): DiscordStats {
		const baseStats = super.getStats();
		return {
			connected: this.client.readyAt !== null,
			ready: this.client.isReady(),
			messagesReceived: baseStats.messagesReceived,
			messagesSent: baseStats.messagesSent,
			errors: baseStats.errors,
			lastActivity: baseStats.lastActivity,
			mediaSent: this.mediaSent,
			activeStreams: this.streamBuffers.size,
			activeTyping: this.typingIntervals.size,
			connectedGuilds: this.client.guilds.cache.size,
			connectedChannels: this.client.channels.cache.size,
		};
	}

	/** Get the bot's user info */
	getBotUser(): any {
		return this.botUser;
	}

	/** Send a text message */
	async sendMessage(
		channelId: string,
		text: string,
		options?: DiscordSendOptions,
	): Promise<{ messageId: string }> {
		const ch = await this.getChannel(channelId);
		if (!ch) throw new Error(`Channel ${channelId} not found`);

		const sendOptions: Record<string, unknown> = {};

		if (options?.mentionAuthor) {
			sendOptions.allowedMentions = {
				parse: ["users"],
				users: [this.botUser.id],
			};
		}

		if (options?.embed) {
			const embed = buildEmbed(options.embed);
			return (ch as any).send({
				content: text,
				...sendOptions,
				embeds: [embed],
				components: options.components ?? [],
				files: options?.files?.map(
					(f) => new AttachmentBuilder(f.data, { name: f.name }),
				),
				flags: options?.inThread ? [MessageFlags.HasThread] : undefined,
				threadId: options?.threadId,
			});
		}

		const result = await (ch as any).send({
			content: text,
			...sendOptions,
			components: options?.components ?? [],
			files: options?.files?.map(
				(f) => new AttachmentBuilder(f.data, { name: f.name }),
			),
			flags: options?.inThread ? [MessageFlags.HasThread] : undefined,
			threadId: options?.threadId,
			tts: options?.tts,
			stickerIds: options?.stickerIds,
		});

		return { messageId: result.id };
	}

	/** Send an embed-only message */
	async sendEmbed(
		channelId: string,
		embed: DiscordEmbed,
	): Promise<{ messageId: string }> {
		const ch = await this.getChannel(channelId);
		if (!ch) throw new Error(`Channel ${channelId} not found`);

		const builder = buildEmbed(embed);
		const result = await (ch as any).send({ embeds: [builder] });
		return { messageId: result.id };
	}

	/** Send a message with buttons */
	async sendWithButtons(
		channelId: string,
		content: string,
		buttons: Array<{ label: string; style: ButtonStyle; customId: string }>,
		options?: DiscordSendOptions,
	): Promise<{ messageId: string }> {
		const ch = await this.getChannel(channelId);
		if (!ch) throw new Error(`Channel ${channelId} not found`);

		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			buttons.map((b) =>
				new ButtonBuilder()
					.setLabel(b.label)
					.setStyle(b.style)
					.setCustomId(b.customId),
			),
		);

		const result = await (ch as any).send({
			content,
			components: [row],
			...options,
		});

		return { messageId: result.id };
	}

	/** Send a message with a select menu */
	async sendWithSelectMenu(
		channelId: string,
		content: string,
		placeholder: string,
		options: Array<{
			label: string;
			value: string;
			description?: string;
			default?: boolean;
		}>,
		customId: string,
	): Promise<{ messageId: string }> {
		const ch = await this.getChannel(channelId);
		if (!ch) throw new Error(`Channel ${channelId} not found`);

		const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
			new StringSelectMenuBuilder()
				.setCustomId(customId)
				.setPlaceholder(placeholder)
				.addOptions(
					options.map((o) => ({
						label: o.label,
						value: o.value,
						description: o.description,
						default: o.default,
					})),
				),
		);

		const result = await (ch as any).send({ content, components: [row] });
		return { messageId: result.id };
	}

	/** Edit an existing message */
	async editMessage(
		channelId: string,
		messageId: string,
		content: string,
		options?: DiscordSendOptions,
	): Promise<void> {
		const ch = await this.getChannel(channelId);
		if (!ch) throw new Error(`Channel ${channelId} not found`);

		const msg = await (ch as any).messages.fetch(messageId);
		if (options?.embed) {
			await msg.edit({ content, embeds: [buildEmbed(options.embed)] });
		} else {
			await msg.edit({ content });
		}
	}

	/** Delete a message */
	async deleteMessage(channelId: string, messageId: string): Promise<void> {
		const ch = await this.getChannel(channelId);
		if (!ch) throw new Error(`Channel ${channelId} not found`);

		const msg = await (ch as any).messages.fetch(messageId);
		await msg.delete();
	}

	/** Send a typing indicator */
	async sendTyping(channelId: string): Promise<void> {
		const ch = await this.getChannel(channelId);
		if (!ch) throw new Error(`Channel ${channelId} not found`);

		await (ch as any).sendTyping();
	}

	/** React to a message with an emoji */
	async addReaction(
		channelId: string,
		messageId: string,
		emoji: string,
	): Promise<void> {
		const ch = await this.getChannel(channelId);
		if (!ch) throw new Error(`Channel ${channelId} not found`);

		const msg = await (ch as any).messages.fetch(messageId);
		await msg.react(emoji);
	}

	/** Remove a reaction from a message */
	async removeReaction(
		channelId: string,
		messageId: string,
		emoji: string,
	): Promise<void> {
		const ch = await this.getChannel(channelId);
		if (!ch) throw new Error(`Channel ${channelId} not found`);

		const msg = await (ch as any).messages.fetch(messageId);
		await msg.reactions.cache.get(emoji)?.remove();
	}

	/** Get message reactions */
	async getReactions(
		channelId: string,
		messageId: string,
	): Promise<DiscordReaction[]> {
		const ch = await this.getChannel(channelId);
		if (!ch) throw new Error(`Channel ${channelId} not found`);

		const msg = await (ch as any).messages.fetch(messageId);
		const reactions = await msg.reactions.fetch();
		return Array.from(reactions.values()).map((r: any) => ({
			emoji: { id: r.emoji.id, name: r.emoji.name },
			count: r.count,
			me: r.me,
		}));
	}

	/** Fetch a channel by ID */
	async getChannel(
		channelId: string,
	): Promise<
		| TextChannel
		| NewsChannel
		| VoiceChannel
		| StageChannel
		| ForumChannel
		| MediaChannel
		| ThreadChannel
		| DMChannel
		| null
	> {
		try {
			const channel = await this.client.channels.fetch(channelId);
			if (
				channel &&
				(channel.type === ChannelType.GuildText ||
					channel.type === ChannelType.GuildAnnouncement ||
					channel.type === ChannelType.GuildVoice ||
					channel.type === ChannelType.GuildStageVoice ||
					channel.type === ChannelType.GuildForum ||
					channel.type === ChannelType.GuildMedia ||
					channel.type === ChannelType.PublicThread ||
					channel.type === ChannelType.PrivateThread ||
					channel.type === ChannelType.DM)
			) {
				return channel as TextChannel
				| NewsChannel
				| VoiceChannel
				| StageChannel
				| ForumChannel
				| MediaChannel
				| ThreadChannel
				| DMChannel;
		}
		return null;
	} catch {
		return null;
	}
}

	/** Get channel info */
	async getChannelInfo(channelId: string): Promise<DiscordChannelInfo | null> {
		const channel = await this.getChannel(channelId);
		if (!channel) return null;

		const info: DiscordChannelInfo = {
			id: channel.id,
			name: "name" in channel
				? (channel as { name: string }).name
				: "Unknown",
			type: channel.type,
		};

		if ("topic" in channel) info.topic = (channel as { topic?: string }).topic;
		if ("guildId" in channel && (channel as { guildId?: string }).guildId)
			info.guildId = (channel as { guildId?: string }).guildId;

		return info;
	}

	/** Get guild info */
	async getGuildInfo(guildId: string): Promise<DiscordGuildInfo | null> {
		try {
			const guild = await this.client.guilds.fetch(guildId);
			if (!guild) return null;

			return {
				id: guild.id,
				name: guild.name,
				icon: guild.iconURL() ?? undefined,
				ownerId: guild.ownerId,
				memberCount: guild.memberCount,
				description: guild.description ?? undefined,
				vanityUrl: guild.vanityURLCode ?? undefined,
				premiumTier: guild.premiumTier,
			};
		} catch {
			return null;
		}
	}

	/** Get user info */
	async getUserInfo(userId: string): Promise<DiscordUserInfo | null> {
		try {
			const user = await this.client.users.fetch(userId);
			return {
				id: user.id,
				username: user.username,
				discriminator: user.discriminator,
				avatar: user.avatarURL() ?? undefined,
				bot: user.bot,
				system: user.system,
				verified: undefined,
				flags: undefined,
				premiumType: undefined,
				publicFlags: undefined,
			};
		} catch {
			return null;
		}
	}

	/** Check if the bot has a permission in a channel */
	async hasPermission(
		channelId: string,
		permission: keyof DiscordPermission,
	): Promise<boolean> {
		const channel = await this.getChannel(channelId);
		if (!channel) return false;

		const me = (channel as { guild?: { members?: { me?: { permissions: { has: (perm: bigint) => boolean } } } } }).guild?.members?.me;
		if (!me) return false;

		const permBit = (PermissionsBitField.Flags as Record<string, bigint>)[permission];
		if (!permBit) return false;

		return me.permissions.has(permBit);
	}

	/** Get all permissions for the bot in a channel */
	async getPermissions(channelId: string): Promise<DiscordPermission> {
		const channel = await this.getChannel(channelId);
		if (!channel) {
			return this.defaultPermissions();
		}

		const me = (channel as { guild?: { members?: { me?: { permissions: { has: (perm: bigint) => boolean } } } } }).guild?.members?.me;
		if (!me) return this.defaultPermissions();

		const perms = me.permissions;
		const flags = PermissionsBitField.Flags as Record<string, bigint>;

		return {
			createInstantInvite: perms.has(flags.CreateInstantInvite),
			kickMembers: perms.has(flags.KickMembers),
			banMembers: perms.has(flags.BanMembers),
			administrator: perms.has(flags.Administrator),
			manageChannels: perms.has(flags.ManageChannels),
			manageGuild: perms.has(flags.ManageGuild),
			addReactions: perms.has(flags.AddReactions),
			viewAuditLog: perms.has(flags.ViewAuditLog),
			voicePrioritySpeaker: perms.has(flags.PrioritySpeaker),
			stream: perms.has(flags.Stream),
			readMessages: perms.has(flags.SendMessages),
			sendMessages: perms.has(flags.SendMessages),
			sendTTSMessages: perms.has(flags.SendTTSMessages),
			manageMessages: perms.has(flags.ManageMessages),
			embedLinks: perms.has(flags.EmbedLinks),
			attachFiles: perms.has(flags.AttachFiles),
			readMessageHistory: perms.has(flags.ReadMessageHistory),
			mentionEveryone: perms.has(flags.MentionEveryone),
			useExternalEmojis: perms.has(flags.UseExternalEmojis),
			viewGuildInsights: perms.has(flags.ViewGuildInsights),
			voiceConnect: perms.has(flags.Connect),
			voiceSpeak: perms.has(flags.Speak),
			voiceSilenceMembers: perms.has(flags.MuteMembers),
			voiceDeafenMembers: perms.has(flags.DeafenMembers),
			voiceMoveMembers: perms.has(flags.MoveMembers),
			voiceUseVAD: perms.has(flags.UseVAD),
			changeNickname: perms.has(flags.ChangeNickname),
			manageNicknames: perms.has(flags.ManageNicknames),
			manageRoles: perms.has(flags.ManageRoles),
			manageWebhooks: perms.has(flags.ManageWebhooks),
			manageEmojisAndStickers: perms.has(flags.ManageEmojisAndStickers),
			useApplicationCommands: perms.has(flags.UseApplicationCommands),
			requestToSpeak: perms.has(flags.RequestToSpeak),
			manageEvents: perms.has(flags.ManageEvents),
			manageThreads: perms.has(flags.ManageThreads),
			createPublicThreads: perms.has(flags.CreatePublicThreads),
			createPrivateThreads: perms.has(flags.CreatePrivateThreads),
			useExternalStickers: perms.has(flags.UseExternalStickers),
			sendMessagesInThreads: perms.has(flags.SendMessagesInThreads),
			useEmbeddedActivities: perms.has(flags.UseEmbeddedActivities),
			moderateMembers: perms.has(flags.ModerateMembers),
			viewCreatorMonetizationAnalytics: perms.has(
				flags.ViewCreatorMonetizationAnalytics,
			),
			useSoundboard: perms.has(flags.UseSoundboard),
			createGuildExpressions: perms.has(flags.CreateGuildExpressions),
			createEvents: perms.has(flags.CreateEvents),
			useExternalSounds: perms.has(flags.UseExternalSounds),
			sendVoiceMessages: perms.has(flags.SendVoiceMessages),
			sendPolls: perms.has(flags.SendPolls),
			useExternalApps: perms.has(flags.UseExternalApps),
		};
	}

	/** Register slash commands */
	async registerCommands(
		commands: Array<{
			name: string;
			description: string;
			type?: ApplicationCommandType;
			options?: Array<{
				name: string;
				description: string;
				type: ApplicationCommandOptionType;
				required?: boolean;
				choices?: Array<{ name: string; value: string | number }>;
			}>;
		}>,
		guildId?: string,
	): Promise<void> {
		const rest = new REST({ version: "10" }).setToken(this.config.token);

		const body = commands.map((cmd) => ({
			name: cmd.name,
			description: cmd.description,
			type: cmd.type ?? ApplicationCommandType.ChatInput,
			options: cmd.options,
		}));

		if (guildId) {
			await rest.put(
				Routes.applicationGuildCommands(this.config.clientId || "", guildId),
				{ body },
			);
		} else {
			await rest.put(Routes.applicationCommands(this.config.clientId || ""), {
				body,
			});
		}
	}

	/** Get registered commands */
	async getCommands(guildId?: string): Promise<APIApplicationCommand[]> {
		const rest = new REST({ version: "10" }).setToken(this.config.token);

		if (guildId) {
			const cmds = await rest.get(
				Routes.applicationGuildCommands(this.config.clientId || "", guildId),
			);
			return cmds as APIApplicationCommand[];
		} else {
			const cmds = await rest.get(
				Routes.applicationCommands(this.config.clientId || ""),
			);
			return cmds as APIApplicationCommand[];
		}
	}

	/** Delete a command */
	async deleteCommand(commandName: string, guildId?: string): Promise<void> {
		const rest = new REST({ version: "10" }).setToken(this.config.token);

		if (guildId) {
			await rest.delete(
				Routes.applicationGuildCommand(
					this.config.clientId || "",
					guildId,
					commandName,
				),
			);
		} else {
			await rest.delete(
				Routes.applicationCommand(this.config.clientId || "", commandName),
			);
		}
	}

	/** Check if the channel is healthy */
	async healthCheck(): Promise<boolean> {
		return this.client.isReady();
	}

	// ── Private helpers ────────────────────────────────────────────────────────

	private startPresence(): void {
		this.presenceInterval = setInterval(() => {
			if (!this.client.isReady()) return;
			// Placeholder: update presence as needed
		}, this.config.presenceInterval);
	}

	private defaultPermissions(): DiscordPermission {
		return Object.fromEntries(
			Object.keys(PermissionsBitField.Flags).map((k) => [
				k.toLowerCase(),
				false,
			]),
		) as unknown as DiscordPermission;
	}
}
