/**
 * Telegram Channel — Bot API integration for synthtek
 */

import { BaseChannel } from "../base-channel.js";
import { TelegramApiClient } from "./api.js";
import {
	extractCommand,
	getMediaType,
	isCommand,
	isRemoteMediaUrl,
	MEDIA_SEND_METHODS,
	markdownToTelegramHtml,
	mentionsBot,
	parseMessage,
	sleep,
	splitMessage,
	TELEGRAM_MAX_MESSAGE_LEN,
	toolHintToTelegramBlockquote,
	validateUrlTarget,
} from "./format.js";
import type {
	TelegramApiResponse,
	TelegramBotCommand,
	TelegramCallbackQuery,
	TelegramChannelInfo,
	TelegramChatMember,
	TelegramConfig,
	TelegramInlineQuery,
	TelegramMedia,
	TelegramMediaGroupBuffer,
	TelegramMessage,
	TelegramOutboundMessage,
	TelegramReaction,
	TelegramSendOptions,
	TelegramStats,
	TelegramStreamBuffer,
	TelegramUserInfo,
} from "./types.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const STREAM_EDIT_INTERVAL_MS = 600;
const TYPING_REFRESH_INTERVAL_MS = 4000;
const MEDIA_GROUP_BUFFER_MS = 1000;

// ─── Telegram Channel ────────────────────────────────────────────────────────

/** Bot commands registered with Telegram's command menu */
const BOT_COMMANDS: TelegramBotCommand[] = [
	{ command: "start", description: "Start the bot" },
	{ command: "new", description: "Start a new conversation" },
	{ command: "stop", description: "Stop the current task" },
	{ command: "restart", description: "Restart the bot" },
	{ command: "status", description: "Show bot status" },
	{ command: "dream", description: "Run Dream memory consolidation now" },
	{ command: "dream_log", description: "Show the latest Dream memory change" },
	{
		command: "dream_restore",
		description: "Restore Dream memory to an earlier version",
	},
	{ command: "help", description: "Show available commands" },
];

export class TelegramChannel extends BaseChannel<
	TelegramConfig,
	TelegramMessage
> {
	protected config: Required<TelegramConfig>;
	private api: TelegramApiClient;
	private botInfo: { username?: string; id?: number } = {};
	private pollingState: {
		lastUpdateId: number;
		active: boolean;
		interval?: ReturnType<typeof setInterval>;
		reconnectAttempts: number;
	} = { lastUpdateId: 0, active: false, reconnectAttempts: 0 };
	private typingTimeout = new Map<
		string | number,
		ReturnType<typeof setTimeout>
	>();

	// Advanced state
	private streamBuffers = new Map<number | string, TelegramStreamBuffer>();
	private typingTasks = new Map<
		number | string,
		ReturnType<typeof setInterval>
	>();
	private mediaGroupState: {
		buffers: Map<number | string, TelegramMediaGroupBuffer>;
		timeouts: Map<number | string, ReturnType<typeof setTimeout>>;
	} = { buffers: new Map(), timeouts: new Map() };
	private messageThreads = new Map<string, number>(); // "chatId:replyToMsgId" -> threadId
	private chatIds = new Map<string, number>(); // senderId -> chatId for replies
	private mediaSent = 0;

	constructor(config: TelegramConfig) {
		super(config);
		this.api = new TelegramApiClient(config);
		this.config = {
			token: config.token,
			webhookUrl: config.webhookUrl ?? "",
			pollingTimeout: config.pollingTimeout ?? 30,
			maxRetries: config.maxRetries ?? 5,
			retryDelay: config.retryDelay ?? 1000,
			usePolling: config.usePolling ?? true,
			webhookSecretToken: config.webhookSecretToken ?? "",
			allowedUpdates: config.allowedUpdates ?? [],
			allowFrom: config.allowFrom ?? [],
			proxy: config.proxy ?? "",
			replyToMessage: config.replyToMessage ?? false,
			reactEmoji: config.reactEmoji ?? "👀",
			groupPolicy: config.groupPolicy ?? "mention",
			connectionPoolSize: config.connectionPoolSize ?? 32,
			poolTimeout: config.poolTimeout ?? 5.0,
			streaming: config.streaming ?? true,
			maxMessageLength: config.maxMessageLength ?? TELEGRAM_MAX_MESSAGE_LEN,
		};
	}

	// ─── Lifecycle ───────────────────────────────────────────────────────────

	/** Start long polling */
	/**
	 * Start the Telegram bot (backward-compat entry point).
	 * Registers message/error handlers via BaseChannel, then starts connect().
	 */
	async start(
		onMessage: (message: TelegramMessage) => void | Promise<void>,
		onError?: (error: Error) => void,
	): Promise<void> {
		this.onMessage(async (msg) => {
			await onMessage(msg);
		});
		if (onError) this.onError((event) => onError(event.error));
		await this.connect();
	}

	// ─── BaseChannel Lifecycle ─────────────────────────────────────────────────

	/** Connect to Telegram — starts long polling */
	async connect(): Promise<void> {
		this.pollingState.active = true;
		await this.getBotInfo();
		await this.registerBotCommands();
		this.pollingLoop();
	}

	/** Backward-compat stop — delegates to disconnect */
	async stop(): Promise<void> {
		await this.disconnect();
	}

	/** Disconnect from Telegram — stops polling */
	async disconnect(): Promise<void> {
		this.pollingState.active = false;

		// Cancel all typing indicators
		for (const chatId of this.typingTasks.keys()) {
			this.stopTyping(chatId);
		}

		// Cancel all media group timeouts
		for (const timeout of this.mediaGroupState.timeouts.values()) {
			clearTimeout(timeout);
		}
		this.mediaGroupState.timeouts.clear();
		this.mediaGroupState.buffers.clear();

		if (this.pollingState.interval) {
			clearInterval(this.pollingState.interval);
			this.pollingState.interval = undefined;
		}
	}

	/** Register bot commands with Telegram */
	private async registerBotCommands(): Promise<void> {
		try {
			await this.api.apiCallRaw("setMyCommands", {
				commands: BOT_COMMANDS,
			});
		} catch (error) {
			console.warn(`[Telegram] Failed to register bot commands:`, error);
		}
	}

	/** Check if a sender is allowed (allow_from list) */
	isAllowed(senderId: string): boolean {
		const allowList = this.config.allowFrom;
		if (!allowList.length || allowList.includes("*")) {
			return true;
		}

		// Handle "id|username" format
		if (senderId.includes("|")) {
			const [id, username] = senderId.split("|", 2);
			if (id && username) {
				return allowList.includes(id) || allowList.includes(username);
			}
			return false;
		}

		return allowList.includes(senderId);
	}

	/** Check if a message should be processed based on group policy */
	shouldProcessMessage(text: string | undefined, chatType: string): boolean {
		// Private chats always processed
		if (chatType === "private") return true;

		// Group policy
		if (this.config.groupPolicy === "open") return true;
		if (this.config.groupPolicy === "mention") {
			return mentionsBot(text, this.botInfo.username);
		}

		return true;
	}

	/** Get the bot's info */
	async getBotInfo(): Promise<{ username: string; id: number }> {
		const response = await this.api.apiCallRaw("getMe");
		const data = (await response.json()) as {
			ok: boolean;
			result: { username: string; id: number };
		};

		if (!data.ok) {
			throw new Error(`Failed to get bot info: ${JSON.stringify(data)}`);
		}

		this.botInfo.username = data.result.username;
		this.botInfo.id = data.result.id;
		return data.result;
	}

	/** Get the bot's username */
	async getBotUsername(): Promise<string> {
		if (this.botInfo.username) return this.botInfo.username;
		const info = await this.getBotInfo();
		return info.username;
	}

	/** Get the bot's ID */
	async getBotId(): Promise<number | undefined> {
		if (this.botInfo.id) return this.botInfo.id;
		const info = await this.getBotInfo();
		return info.id;
	}

	// ─── Message Sending ─────────────────────────────────────────────────────

	/**
	 * Send a text message.
	 * Supports both positional and object-style signatures.
	 */
	async sendMessage(
		chatIdOrOptions:
			| number
			| string
			| {
					chatId: number | string;
					text: string;
					replyToMessageId?: number;
					disablePreviewLinks?: boolean;
					parseMode?: "HTML" | "Markdown" | "MarkdownV2";
					protectContent?: boolean;
					messageThreadId?: number;
					disableNotification?: boolean;
					allowSendingWithoutReply?: boolean;
			  },
		text?: string,
		options?: TelegramSendOptions,
	): Promise<Array<{ messageId: number }>> {
		// Normalize arguments: support both (chatId, text, opts?) and ({ chatId, text, ...opts })
		const chatId: number | string =
			typeof chatIdOrOptions === "object"
				? chatIdOrOptions.chatId
				: chatIdOrOptions;
		const messageText: string =
			typeof chatIdOrOptions === "object" ? chatIdOrOptions.text : text!;
		const mergedOptions: TelegramSendOptions =
			typeof chatIdOrOptions === "object"
				? {
						replyToMessageId: chatIdOrOptions.replyToMessageId,
						disablePreviewLinks: chatIdOrOptions.disablePreviewLinks,
						parseMode: chatIdOrOptions.parseMode,
						protectContent: chatIdOrOptions.protectContent,
						messageThreadId: chatIdOrOptions.messageThreadId,
						disableNotification: chatIdOrOptions.disableNotification,
						allowSendingWithoutReply: chatIdOrOptions.allowSendingWithoutReply,
					}
				: (options ?? {});

		const chunks = splitMessage(messageText, this.config.maxMessageLength);
		const results: Array<{ messageId: number }> = [];

		for (let i = 0; i < chunks.length; i++) {
			const response = await this.api.apiCallRaw("sendMessage", {
				chat_id: chatId,
				text: chunks[i],
				parse_mode: mergedOptions?.parseMode,
				disable_web_page_preview: mergedOptions?.disablePreviewLinks,
				protect_content: mergedOptions?.protectContent,
				disable_notification: mergedOptions?.disableNotification,
				allow_sending_without_reply: mergedOptions?.allowSendingWithoutReply,
				...(mergedOptions?.replyToMessageId !== undefined && i === 0
					? { reply_to_message_id: mergedOptions.replyToMessageId }
					: {}),
				...(mergedOptions?.messageThreadId !== undefined && i === 0
					? { message_thread_id: mergedOptions.messageThreadId }
					: {}),
			});

			const data = (await response.json()) as {
				ok: boolean;
				result: { message_id: number };
			};
			if (!data.ok) {
				throw new Error(`Failed to send message: ${JSON.stringify(data)}`);
			}

			results.push({ messageId: data.result.message_id });
			this.recordSent();
		}

		return results;
	}

	/** Send text with HTML conversion from markdown (with plain text fallback) */
	async sendTextWithHtml(
		chatId: number | string,
		text: string,
		replyParams?: { messageId?: number; allowSendingWithoutReply?: boolean },
		threadKwargs?: { message_thread_id?: number },
		renderAsBlockquote = false,
	): Promise<void> {
		try {
			const html = renderAsBlockquote
				? toolHintToTelegramBlockquote(text)
				: markdownToTelegramHtml(text);

			await this.api.apiCallRaw("sendMessage", {
				chat_id: chatId,
				text: html,
				parse_mode: "HTML",
				reply_parameters: replyParams
					? {
							message_id: replyParams.messageId,
							allow_sending_without_reply:
								replyParams.allowSendingWithoutReply ?? true,
						}
					: undefined,
				...threadKwargs,
			});
			this.recordSent();
		} catch (error) {
			// Fallback to plain text
			console.warn(
				`[Telegram] HTML parse failed, falling back to plain text:`,
				error,
			);
			try {
				await this.api.apiCallRaw("sendMessage", {
					chat_id: chatId,
					text,
					parse_mode: undefined,
					reply_parameters: replyParams
						? {
								message_id: replyParams.messageId,
								allow_sending_without_reply:
									replyParams.allowSendingWithoutReply ?? true,
							}
						: undefined,
					...threadKwargs,
				});
				this.recordSent();
			} catch (fallbackError) {
				console.error(`[Telegram] Failed to send message:`, fallbackError);
			}
		}
	}

	/** Send an outbound message (integration with agent loop) */
	async sendOutboundMessage(msg: TelegramOutboundMessage): Promise<void> {
		if (!this.isConnected()) {
			console.warn("[Telegram] Bot not running");
			return;
		}

		// Only stop typing indicator and remove reaction for final responses
		if (!msg.metadata._progress) {
			this.stopTyping(msg.chatId);
			if (msg.metadata.message_id) {
				try {
					await this.removeReactions(msg.chatId, msg.metadata.message_id);
				} catch {
					// Ignore
				}
			}
		}

		let chatId: number;
		try {
			chatId = parseInt(String(msg.chatId), 10);
		} catch {
			console.error(`[Telegram] Invalid chat_id: ${msg.chatId}`);
			return;
		}

		const replyToMessageId = msg.metadata.message_id;
		let messageThreadId = msg.metadata.message_thread_id;
		if (messageThreadId === undefined && replyToMessageId !== undefined) {
			const key = `${msg.chatId}:${replyToMessageId}`;
			messageThreadId = this.messageThreads.get(key);
		}
		const threadKwargs =
			messageThreadId !== undefined
				? { message_thread_id: messageThreadId }
				: {};

		const replyParams =
			this.config.replyToMessage && replyToMessageId
				? { messageId: replyToMessageId, allowSendingWithoutReply: true }
				: undefined;

		// Send media files
		for (const mediaPath of msg.media ?? []) {
			try {
				const mediaType = getMediaType(mediaPath);

				const sendMethod = MEDIA_SEND_METHODS[mediaType] ?? "sendDocument";
				const mediaField = mediaType === "photo" ? "photo" : mediaType;

				if (isRemoteMediaUrl(mediaPath)) {
					const [ok, error] = validateUrlTarget(mediaPath);
					if (!ok) {
						throw new Error(`unsafe media URL: ${error}`);
					}
					await this.api.apiCallRaw(sendMethod, {
						chat_id: chatId,
						[mediaField]: mediaPath,
						reply_parameters: replyParams,
						...threadKwargs,
					});
					this.mediaSent++;
					continue;
				}

				// Local file - in production, use FormData
				await this.api.apiCallRaw(sendMethod, {
					chat_id: chatId,
					[mediaField]: mediaPath,
					reply_parameters: replyParams,
					...threadKwargs,
				});
				this.mediaSent++;
			} catch (error) {
				const filename = mediaPath.split("/").pop() ?? mediaPath;
				console.error(`[Telegram] Failed to send media ${mediaPath}:`, error);
				await this.api.apiCallRaw("sendMessage", {
					chat_id: chatId,
					text: `[Failed to send: ${filename}]`,
					reply_parameters: replyParams,
					...threadKwargs,
				});
			}
		}

		// Send text content
		if (msg.content && msg.content !== "[empty message]") {
			const renderAsBlockquote = !!msg.metadata._tool_hint;
			for (const chunk of splitMessage(
				msg.content,
				this.config.maxMessageLength,
			)) {
				await this.sendTextWithHtml(
					chatId,
					chunk,
					replyParams,
					threadKwargs,
					renderAsBlockquote,
				);
			}
		}
	}

	/** Send a media message (photo, document, video, etc.) */
	async sendMedia(
		chatId: number | string,
		media: TelegramMedia,
		options?: TelegramSendOptions,
	): Promise<{ messageId: number } | null> {
		const method = `send${media.type.charAt(0).toUpperCase() + media.type.slice(1)}`;
		const body: Record<string, unknown> = {
			chat_id: chatId,
			[media.type]: media.media,
			caption: media.caption,
			parse_mode: media.parseMode,
		};

		if (options?.messageThreadId !== undefined) {
			body.message_thread_id = options.messageThreadId;
		}

		const response = await this.api.apiCallRaw(method, body);
		const data = (await response.json()) as {
			ok: boolean;
			result?: { message_id: number };
		};

		if (!data.ok) {
			throw new Error(`Failed to send ${media.type}: ${JSON.stringify(data)}`);
		}

		return data.result ? { messageId: data.result.message_id } : null;
	}

	/** Send multiple media items as an album */
	async sendAlbum(
		chatId: number | string,
		media: Array<{
			type: "photo" | "document";
			media: string;
			caption?: string;
		}>,
		options?: TelegramSendOptions,
	): Promise<Array<{ messageId: number }> | null> {
		const body: Record<string, unknown> = {
			chat_id: chatId,
			media: JSON.stringify(media),
		};

		if (options?.messageThreadId !== undefined) {
			body.message_thread_id = options.messageThreadId;
		}

		const response = await this.api.apiCallRaw("sendMediaAlbum", body);
		const data = (await response.json()) as {
			ok: boolean;
			result?: Array<{ message_id: number }>;
		};

		if (!data.ok) {
			throw new Error(`Failed to send album: ${JSON.stringify(data)}`);
		}

		return data.result?.map((m) => ({ messageId: m.message_id })) || null;
	}

	/** Send a file by URL or file path */
	async sendFile(
		chatId: number | string,
		fileType: "document" | "audio" | "video" | "photo" | "animation",
		file: { name: string; data: Buffer | string },
		caption?: string,
		options?: TelegramSendOptions,
	): Promise<{ messageId: number } | null> {
		const method = `send${fileType.charAt(0).toUpperCase() + fileType.slice(1)}`;
		const body: Record<string, unknown> = {
			chat_id: chatId,
			caption,
			parse_mode: options?.parseMode,
		};

		if (options?.messageThreadId !== undefined) {
			body.message_thread_id = options.messageThreadId;
		}

		// If data is a Buffer, send as uploaded file
		if (Buffer.isBuffer(file.data)) {
			// Use FormData for binary file uploads
			const formData = new FormData();
			formData.append("chat_id", String(chatId));
			const blob = new Blob([file.data.buffer as ArrayBuffer], {
				type: "application/octet-stream",
			});
			formData.append(fileType, blob, file.name);
			if (caption) formData.append("caption", caption);
			if (options?.parseMode) formData.append("parse_mode", options.parseMode);
			if (options?.messageThreadId !== undefined) {
				formData.append("message_thread_id", String(options.messageThreadId));
			}

			const response = await fetch(this.api.getApiUrl(method), {
				method: "POST",
				body: formData,
			});
			const data = (await response.json()) as {
				ok: boolean;
				result?: { message_id: number };
			};
			if (!data.ok) {
				throw new Error(`Failed to send ${fileType}: ${JSON.stringify(data)}`);
			}
			return data.result ? { messageId: data.result.message_id } : null;
		}

		// For string URLs, use the standard JSON API
		body[fileType] = file.data;

		const response = await this.api.apiCallRaw(method, body);
		const data = (await response.json()) as {
			ok: boolean;
			result?: { message_id: number };
		};

		if (!data.ok) {
			throw new Error(`Failed to send ${fileType}: ${JSON.stringify(data)}`);
		}

		return data.result ? { messageId: data.result.message_id } : null;
	}

	// ─── Message Management ──────────────────────────────────────────────────

	/** Edit a message */
	async editMessage(
		chatId: number | string,
		messageId: number,
		text: string,
		options?: TelegramSendOptions,
	): Promise<{ messageId: number } | null> {
		const response = await this.api.apiCallRaw("editMessageText", {
			chat_id: chatId,
			message_id: messageId,
			text,
			parse_mode: options?.parseMode,
			disable_web_page_preview: options?.disablePreviewLinks,
		});

		const data = (await response.json()) as {
			ok: boolean;
			result?: { message_id: number };
		};
		if (!data.ok) {
			throw new Error(`Failed to edit message: ${JSON.stringify(data)}`);
		}

		return data.result ? { messageId: data.result.message_id } : null;
	}

	/** Edit a media caption */
	async editCaption(
		chatId: number | string,
		messageId: number,
		caption: string,
		options?: TelegramSendOptions,
	): Promise<{ messageId: number } | null> {
		const response = await this.api.apiCallRaw("editMessageCaption", {
			chat_id: chatId,
			message_id: messageId,
			caption,
			parse_mode: options?.parseMode,
		});

		const data = (await response.json()) as {
			ok: boolean;
			result?: { message_id: number };
		};
		if (!data.ok) {
			throw new Error(`Failed to edit caption: ${JSON.stringify(data)}`);
		}

		return data.result ? { messageId: data.result.message_id } : null;
	}

	/** Delete a message */
	async deleteMessage(
		chatId: number | string,
		messageId: number,
	): Promise<boolean> {
		const response = await this.api.apiCallRaw("deleteMessage", {
			chat_id: chatId,
			message_id: messageId,
		});

		const data = (await response.json()) as { ok: boolean };
		return data.ok;
	}

	/** Pin a message */
	async pinMessage(
		chatId: number | string,
		messageId: number,
		disableNotification?: boolean,
	): Promise<boolean> {
		const response = await this.api.apiCallRaw("pinChatMessage", {
			chat_id: chatId,
			message_id: messageId,
			disable_notification: disableNotification,
		});

		const data = (await response.json()) as { ok: boolean };
		return data.ok;
	}

	/** Unpin a message */
	async unpinMessage(
		chatId: number | string,
		messageId?: number,
	): Promise<boolean> {
		const body: Record<string, unknown> = { chat_id: chatId };
		if (messageId !== undefined) {
			body.message_id = messageId;
		}

		const response = await this.api.apiCallRaw("unpinChatMessage", body);
		const data = (await response.json()) as { ok: boolean };
		return data.ok;
	}

	/** Unpin all messages in a topic/chat */
	async unpinAllMessages(chatId: number | string): Promise<boolean> {
		const response = await this.api.apiCallRaw("unpinAllChatMessages", {
			chat_id: chatId,
		});
		const data = (await response.json()) as { ok: boolean };
		return data.ok;
	}

	// ─── Typing & Reactions ──────────────────────────────────────────────────

	/** Send a typing indicator with auto-refresh */
	async sendTyping(chatId: number | string, action = "typing"): Promise<void> {
		// Clear previous typing timeout for this chat
		const existingTimeout = this.typingTimeout.get(chatId);
		if (existingTimeout) {
			clearTimeout(existingTimeout);
		}

		// Clear previous typing interval for this chat
		this.stopTyping(chatId);

		await this.api.apiCallRaw("sendChatAction", {
			chat_id: chatId,
			action,
		});

		// Set up auto-refresh interval
		const interval = setInterval(async () => {
			try {
				await this.api.apiCallRaw("sendChatAction", {
					chat_id: chatId,
					action,
				});
			} catch {
				// Ignore errors in typing refresh
				this.stopTyping(chatId);
			}
		}, TYPING_REFRESH_INTERVAL_MS);
		this.typingTasks.set(chatId, interval);

		// Auto-stop after 30 seconds
		this.typingTimeout.set(
			chatId,
			setTimeout(() => {
				this.stopTyping(chatId);
			}, 30_000),
		);
	}

	/** Stop typing indicator for a chat */
	stopTyping(chatId: number | string): void {
		const interval = this.typingTasks.get(chatId);
		if (interval) {
			clearInterval(interval);
			this.typingTasks.delete(chatId);
		}
		const timeout = this.typingTimeout.get(chatId);
		if (timeout) {
			clearTimeout(timeout);
			this.typingTimeout.delete(chatId);
		}
	}

	// ─── Streaming ───────────────────────────────────────────────────────────

	/** Start a streaming session for a chat */
	startStream(
		chatId: number | string,
		messageId: number,
		streamId: string,
	): void {
		this.streamBuffers.set(chatId, {
			text: "",
			messageId,
			lastEdit: Date.now(),
			streamId,
		});
	}

	/** Push text to a streaming session (progressive editing) */
	async pushStreamText(chatId: number | string, text: string): Promise<void> {
		const buf = this.streamBuffers.get(chatId);
		if (!buf) return;

		buf.text += text;
		const now = Date.now();

		// Only edit if enough time has passed since last edit
		if (now - buf.lastEdit >= STREAM_EDIT_INTERVAL_MS) {
			try {
				const html = markdownToTelegramHtml(buf.text);
				await this.api.apiCallRaw("editMessageText", {
					chat_id: chatId,
					message_id: buf.messageId,
					text: html,
					parse_mode: "HTML",
				});
				buf.lastEdit = now;
			} catch {
				// Ignore edit errors during streaming
			}
		}
	}

	/** Finalize a streaming session */
	async finalizeStream(chatId: number | string): Promise<void> {
		const buf = this.streamBuffers.get(chatId);
		if (!buf) return;

		// Final edit to ensure complete text is shown
		try {
			const html = markdownToTelegramHtml(buf.text);
			await this.api.apiCallRaw("editMessageText", {
				chat_id: chatId,
				message_id: buf.messageId,
				text: html,
				parse_mode: "HTML",
			});
		} catch {
			// Ignore final edit errors
		}

		this.streamBuffers.delete(chatId);
	}

	/** Cancel a streaming session */
	cancelStream(chatId: number | string): void {
		this.streamBuffers.delete(chatId);
	}

	/** Get active stream count */
	getActiveStreamCount(): number {
		return this.streamBuffers.size;
	}

	/** Add a reaction to a message */
	async addReaction(
		chatId: number | string,
		messageId: number,
		emoji: string,
	): Promise<boolean> {
		const response = await this.api.apiCallRaw("setMessageReaction", {
			chat_id: chatId,
			message_id: messageId,
			reaction: JSON.stringify([{ type: "emoji", emoji }]),
		});

		const data = (await response.json()) as { ok: boolean };
		return data.ok;
	}

	/** Remove all reactions from a message */
	async removeReactions(
		chatId: number | string,
		messageId: number,
	): Promise<boolean> {
		const response = await this.api.apiCallRaw("setMessageReaction", {
			chat_id: chatId,
			message_id: messageId,
			reaction: JSON.stringify([]),
		});

		const data = (await response.json()) as { ok: boolean };
		return data.ok;
	}

	/** Get message reactions */
	async getReactions(
		chatId: number | string,
		messageId: number,
	): Promise<TelegramReaction[]> {
		const response = await this.api.apiCallRaw("getMessageReactions", {
			chat_id: chatId,
			message_id: messageId,
		});

		const data = (await response.json()) as {
			ok: boolean;
			result?: {
				type: { type: string; emoji?: string };
				count: number;
				is_personal?: boolean;
			}[];
		};

		if (!data.ok || !data.result) return [];

		return data.result.map((r) => ({
			emoji: r.type.emoji ?? "",
			type: r.type.type,
			count: r.count,
			isPersonal: r.is_personal ?? false,
		}));
	}

	// ─── Chat Management ─────────────────────────────────────────────────────

	/** Get chat info */
	async getChatInfo(
		chatId: number | string,
	): Promise<TelegramChannelInfo | null> {
		const response = await this.api.apiCallRaw("getChat", { chat_id: chatId });
		const data = (await response.json()) as TelegramApiResponse;

		if (!data.ok || !data.result) return null;

		// Raw API response — parse at the boundary
		const chat = data.result as Record<string, unknown>;
		const photo = chat.photo as Record<string, string> | undefined;
		const perms = chat.permissions as Record<string, boolean> | undefined;
		const pinned = chat.pinned_message as Record<string, number> | undefined;

		return {
			id: chat.id as number,
			type: chat.type as TelegramChannelInfo["type"],
			title: chat.title as string | undefined,
			username: chat.username as string | undefined,
			firstName: chat.first_name as string | undefined,
			lastName: chat.last_name as string | undefined,
			photo: photo
				? { smallFileId: photo.small_file_id, bigFileId: photo.big_file_id }
				: undefined,
			bio: chat.bio as string | undefined,
			description: chat.description as string | undefined,
			inviteLink: chat.invite_link as string | undefined,
			pinnedMessageId: pinned?.message_id,
			permissions: perms
				? {
						canSendMessages: perms.can_send_messages,
						canSendMediaMessages: perms.can_send_media_messages,
						canSendPolls: perms.can_send_polls,
						canSendOtherMessages: perms.can_send_other_messages,
						canAddWebPagePreviews: perms.can_add_web_page_previews,
						canChangeInfo: perms.can_change_info,
						canInviteUsers: perms.can_invite_users,
						canPinMessages: perms.can_pin_messages,
						canManageTopics: perms.can_manage_topics,
					}
				: undefined,
			slowModeDelay: chat.slow_mode_delay as number | undefined,
			stickerSetName: chat.sticker_set_name as string | undefined,
			canSetStickerSet: chat.can_set_sticker_set as boolean | undefined,
			memberCount: chat.members_count as number | undefined,
		};
	}

	/** Get chat administrators */
	async getChatAdministrators(
		chatId: number | string,
	): Promise<TelegramChatMember[]> {
		const response = await this.api.apiCallRaw("getChatAdministrators", {
			chat_id: chatId,
		});
		const data = (await response.json()) as TelegramApiResponse<
			TelegramChatMember[]
		>;

		if (!data.ok) return [];
		return data.result ?? [];
	}

	/** Get chat member count */
	async getChatMemberCount(chatId: number | string): Promise<number> {
		const response = await this.api.apiCallRaw("getChatMembersCount", {
			chat_id: chatId,
		});
		const data = (await response.json()) as TelegramApiResponse<number>;

		if (!data.ok) return 0;
		return data.result ?? 0;
	}

	/** Get a chat member's info */
	async getChatMember(
		chatId: number | string,
		userId: number,
	): Promise<TelegramChatMember | null> {
		const response = await this.api.apiCallRaw("getChatMember", {
			chat_id: chatId,
			user_id: userId,
		});
		const data =
			(await response.json()) as TelegramApiResponse<TelegramChatMember>;

		if (!data.ok) return null;
		return data.result ?? null;
	}

	/** Leave a chat */
	async leaveChat(chatId: number | string): Promise<boolean> {
		const response = await this.api.apiCallRaw("leaveChat", {
			chat_id: chatId,
		});
		const data = (await response.json()) as { ok: boolean };
		return data.ok;
	}

	/** Ban a user from a chat */
	async banChatMember(
		chatId: number | string,
		userId: number,
		untilDate?: number,
	): Promise<boolean> {
		const body: Record<string, unknown> = { chat_id: chatId, user_id: userId };
		if (untilDate !== undefined) {
			body.until_date = untilDate;
		}

		const response = await this.api.apiCallRaw("banChatMember", body);
		const data = (await response.json()) as { ok: boolean };
		return data.ok;
	}

	/** Unban a user from a chat */
	async unbanChatMember(
		chatId: number | string,
		userId: number,
		onlyIfBanned?: boolean,
	): Promise<boolean> {
		const body: Record<string, unknown> = { chat_id: chatId, user_id: userId };
		if (onlyIfBanned !== undefined) {
			body.only_if_banned = onlyIfBanned;
		}

		const response = await this.api.apiCallRaw("unbanChatMember", body);
		const data = (await response.json()) as { ok: boolean };
		return data.ok;
	}

	/** Restrict a chat member */
	async restrictChatMember(
		chatId: number | string,
		userId: number,
		permissions: Record<string, boolean>,
		untilDate?: number,
	): Promise<boolean> {
		const body: Record<string, unknown> = {
			chat_id: chatId,
			user_id: userId,
			permissions,
			use_independent_chat_permissions: true,
		};
		if (untilDate !== undefined) {
			body.until_date = untilDate;
		}

		const response = await this.api.apiCallRaw("restrictChatMember", body);
		const data = (await response.json()) as { ok: boolean };
		return data.ok;
	}

	/** Promote a chat member */
	async promoteChatMember(
		chatId: number | string,
		userId: number,
		permissions: {
			isAnonymous?: boolean;
			canManageChat?: boolean;
			canPostMessages?: boolean;
			canEditMessages?: boolean;
			canDeleteMessages?: boolean;
			canManageTopics?: boolean;
			canPostStories?: boolean;
			canEditStories?: boolean;
			canDeleteStories?: boolean;
			canManageVideoChats?: boolean;
			canRestrictMembers?: boolean;
			canPromoteMembers?: boolean;
			canChangeInfo?: boolean;
			canInviteUsers?: boolean;
			canPinMessages?: boolean;
		},
	): Promise<boolean> {
		const response = await this.api.apiCallRaw("promoteChatMember", {
			chat_id: chatId,
			user_id: userId,
			...permissions,
		});

		const data = (await response.json()) as { ok: boolean };
		return data.ok;
	}

	// ─── User Info ───────────────────────────────────────────────────────────

	/** Get user profile info */
	async getUserProfile(userId: number): Promise<TelegramUserInfo | null> {
		const response = await this.api.apiCallRaw("getUserProfilePhotos", {
			user_id: userId,
			offset: 0,
			limit: 1,
		});
		const data = (await response.json()) as TelegramApiResponse<{
			total_count: number;
			photos: Array<Array<Record<string, unknown>>>;
		}>;

		if (!data.ok) return null;

		// Also get user info via getChat
		const chatResponse = await this.api.apiCallRaw("getChat", {
			chat_id: userId,
		});
		const chatData = (await chatResponse.json()) as TelegramApiResponse;

		if (!chatData.ok) return null;

		const chat = chatData.result as Record<string, unknown>;
		return {
			id: chat.id as number,
			username: chat.username as string | undefined,
			firstName: chat.first_name as string | undefined,
			lastName: chat.last_name as string | undefined,
			photo: chat.photo
				? {
						smallFileId: (chat.photo as Record<string, string>).small_file_id,
						bigFileId: (chat.photo as Record<string, string>).big_file_id,
					}
				: undefined,
			bio: chat.bio as string | undefined,
			languageCode: chat.language_code as string | undefined,
			hasPrivateForwards: chat.has_private_forwards as boolean | undefined,
			hasRestrictedVoiceAndVideo: chat.has_restricted_voice_and_video as
				| boolean
				| undefined,
			totalPhotos: data.result?.total_count ?? 0,
		};
	}

	// ─── Webhook ─────────────────────────────────────────────────────────────

	/** Set up webhook */
	async setWebhook(
		url: string,
		secretToken?: string,
		ipAddress?: string,
		maxConnections?: number,
		allowedUpdatesStr?: string,
	): Promise<boolean> {
		const body: Record<string, unknown> = { url };
		if (secretToken) body.secret_token = secretToken;
		if (ipAddress) body.ip_address = ipAddress;
		if (maxConnections) body.max_connections = maxConnections;
		if (allowedUpdatesStr) body.allowed_updates = allowedUpdatesStr;

		const response = await this.api.apiCallRaw("setWebhook", body);
		const data = (await response.json()) as { ok: boolean };
		return data.ok;
	}

	/** Delete webhook (switch to polling) */
	async deleteWebhook(): Promise<boolean> {
		const response = await this.api.apiCallRaw("deleteWebhook");
		const data = (await response.json()) as { ok: boolean };
		return data.ok;
	}

	/** Get webhook info */
	async getWebhookInfo(): Promise<{
		url: string;
		hasCustomCertificate: boolean;
		pendingUpdateCount: number;
		lastErrorDate?: number;
		errorMessage?: string;
	} | null> {
		const response = await this.api.apiCallRaw("getWebhookInfo");
		const data = (await response.json()) as TelegramApiResponse<
			Record<string, unknown>
		>;

		if (!data.ok || !data.result) return null;

		const r = data.result;
		return {
			url: r.url as string,
			hasCustomCertificate: r.has_custom_certificate as boolean,
			pendingUpdateCount: r.pending_update_count as number,
			lastErrorDate: r.last_error_date as number | undefined,
			errorMessage: r.last_error_message as string | undefined,
		};
	}

	// ─── Utilities ───────────────────────────────────────────────────────────

	/** Get file download URL */
	async getFileUrl(fileId: string): Promise<string> {
		const response = await this.api.apiCallRaw("getFile", { file_id: fileId });
		const data = (await response.json()) as {
			ok: boolean;
			result?: { file_path: string };
		};

		if (!data.ok || !data.result) {
			throw new Error(`Failed to get file: ${JSON.stringify(data)}`);
		}

		return `https://api.telegram.org/file/bot${this.config.token}/${data.result.file_path}`;
	}

	/** Copy a message (forward content to another chat) */
	async copyMessage(
		fromChatId: number | string,
		toChatId: number | string,
		messageId: number,
		options?: TelegramSendOptions,
	): Promise<{ messageId: number } | null> {
		const body: Record<string, unknown> = {
			from_chat_id: fromChatId,
			to_chat_id: toChatId,
			message_id: messageId,
		};

		if (options?.parseMode) body.parse_mode = options.parseMode;
		if (options?.disablePreviewLinks !== undefined)
			body.disable_web_page_preview = options.disablePreviewLinks;

		const response = await this.api.apiCallRaw("copyMessage", body);
		const data = (await response.json()) as {
			ok: boolean;
			result?: { message_id: number };
		};

		if (!data.ok) {
			throw new Error(`Failed to copy message: ${JSON.stringify(data)}`);
		}

		return data.result ? { messageId: data.result.message_id } : null;
	}

	/** Forward a message to another chat */
	async forwardMessage(
		fromChatId: number | string,
		toChatId: number | string,
		messageId: number,
	): Promise<{ messageId: number } | null> {
		const response = await this.api.apiCallRaw("forwardMessage", {
			from_chat_id: fromChatId,
			to_chat_id: toChatId,
			message_id: messageId,
		});

		const data = (await response.json()) as {
			ok: boolean;
			result?: { message_id: number };
		};

		if (!data.ok) {
			throw new Error(`Failed to forward message: ${JSON.stringify(data)}`);
		}

		return data.result ? { messageId: data.result.message_id } : null;
	}

	/** Check if the channel is healthy */
	async healthCheck(): Promise<boolean> {
		try {
			const response = await this.api.apiCallRaw("getMe");
			const data = (await response.json()) as { ok: boolean };
			return data.ok;
		} catch {
			return false;
		}
	}

	/** Get client stats */
	getStats(): TelegramStats {
		const baseStats = super.getStats();
		return {
			connected: baseStats.connected,
			polling: this.pollingState.active,
			lastUpdateId: this.pollingState.lastUpdateId,
			messagesReceived: baseStats.messagesReceived,
			messagesSent: baseStats.messagesSent,
			errors: baseStats.errors,
			lastActivity: baseStats.lastActivity,
			mediaSent: this.mediaSent,
			activeStreams: this.streamBuffers.size,
			activeTyping: this.typingTasks.size,
			connectedChats: this.chatIds.size,
		};
	}

	// ─── Private Helpers ────────────────────────────────────────────────────────

	private async pollingLoop(): Promise<void> {
		while (this.pollingState.active && this.isConnected()) {
			try {
				const response = await this.api.apiCallRaw("getUpdates", {
					offset: String(this.pollingState.lastUpdateId + 1),
					timeout: String(this.config.pollingTimeout),
					limit: "100",
				});
				const data = (await response.json()) as { ok: boolean; result: any[] };
				if (!data.ok) continue;
				const updates = data.result;

				for (const update of updates) {
					// Skip old updates
					if (update.update_id <= this.pollingState.lastUpdateId) continue;
					this.pollingState.lastUpdateId = update.update_id;

					// Handle callback queries
					if (update.callback_query) {
						await this.handleCallbackQuery(update.callback_query);
						continue;
					}

					// Handle inline queries
					if (update.inline_query) {
						await this.handleInlineQuery(update.inline_query);
						continue;
					}

					const message = parseMessage(update);
					if (!message) continue;

					this.recordReceived();

					// Check allow_from
					const senderId = `${message.fromId}|${message.fromUsername ?? ""}`;
					if (!this.isAllowed(senderId)) continue;

					// Check group policy
					const chatInfo = await this.getChatInfo(message.chatId);
					if (
						!this.shouldProcessMessage(
							message.text,
							chatInfo?.type ?? "private",
						)
					)
						continue;

					// Track chat IDs for replies
					this.chatIds.set(senderId, message.chatId as number);

					// Track thread IDs
					if (message.threadId && message.replyToMessageId) {
						const key = `${message.chatId}:${message.replyToMessageId}`;
						this.messageThreads.set(key, message.threadId);
					}

					// Handle commands
					if (message.text && isCommand(message.text)) {
						await this.handleCommand(message);
						continue;
					}

					// Start typing indicator
					await this.sendTyping(message.chatId, "typing");

					// React with configured emoji
					if (this.config.reactEmoji) {
						try {
							await this.addReaction(
								message.chatId,
								message.messageId,
								this.config.reactEmoji,
							);
						} catch {
							// Ignore reaction errors
						}
					}

					// Handle media groups
					if (message.messageType !== "text") {
						await this.handleMediaMessage(message);
					}

					// Forward to message handler
					await this.dispatchMessage(message);
				}
			} catch (error) {
				this.pollingState.reconnectAttempts++;
				console.error(
					`[Telegram] Polling error (attempt ${this.pollingState.reconnectAttempts}):`,
					error,
				);

				this.emitError(
					error instanceof Error ? error : new Error(String(error)),
				);

				// Wait before retrying with exponential backoff
				const delay = Math.min(
					this.config.retryDelay * 1.5 ** this.pollingState.reconnectAttempts,
					60000,
				);
				await sleep(delay);
			}
		}
	}

	/** Handle incoming commands */
	private async handleCommand(message: TelegramMessage): Promise<void> {
		const command = extractCommand(message.text ?? "");
		if (!command) return;

		// Route to message handler with command
		await this.dispatchMessage(message);
	}

	/** Handle callback queries (inline buttons, etc.) */
	private async handleCallbackQuery(
		query: TelegramCallbackQuery,
	): Promise<void> {
		try {
			// Answer callback query
			await this.api.apiCallRaw("answerCallbackQuery", {
				callback_query_id: query.id,
			});

			// Forward to message handler if there's data
			if (query.data) {
				await this.dispatchMessage({
					messageId: query.message.messageId,
					chatId: query.message.chat.id,
					fromId: query.from.id,
					fromUsername: query.from.username,
					text: query.data,
					date: Math.floor(Date.now() / 1000),
					messageType: "text",
				});
			}
		} catch (error) {
			console.error("[Telegram] Failed to handle callback query:", error);
		}
	}

	/** Handle inline queries */
	private async handleInlineQuery(query: TelegramInlineQuery): Promise<void> {
		try {
			// Default: return empty results (can be overridden)
			await this.api.apiCallRaw("answerInlineQuery", {
				inline_query_id: query.id,
				results: JSON.stringify([]),
				cache_time: 0,
			});
		} catch (error) {
			console.error("[Telegram] Failed to handle inline query:", error);
		}
	}

	/** Handle media messages with group buffering */
	private async handleMediaMessage(message: TelegramMessage): Promise<void> {
		// Buffer media for potential group/album
		const bufferKey = message.chatId;
		const existing = this.mediaGroupState.buffers.get(bufferKey);

		if (existing) {
			existing.items.push({
				type: message.messageType as "photo" | "document" | "audio" | "video",
				media: message.fileId ?? "",
				caption: message.caption,
			});
			return;
		}

		// Create new buffer
		const buffer: TelegramMediaGroupBuffer = {
			items: [
				{
					type: message.messageType as "photo" | "document" | "audio" | "video",
					media: message.fileId ?? "",
					caption: message.caption,
				},
			],
			chatId: message.chatId,
			timeout: MEDIA_GROUP_BUFFER_MS,
		};
		this.mediaGroupState.buffers.set(bufferKey, buffer);

		// Set timeout to flush buffer
		const timeout = setTimeout(async () => {
			const buf = this.mediaGroupState.buffers.get(bufferKey);
			if (buf && buf.items.length > 0) {
				try {
					await this.api.apiCallRaw("sendMediaGroup", {
						chat_id: buf.chatId,
						media: buf.items,
					});
				} catch (err) {
					console.error("[Telegram] Failed to send media group:", err);
				}
			}
			this.mediaGroupState.buffers.delete(bufferKey);
		}, MEDIA_GROUP_BUFFER_MS);
		this.mediaGroupState.timeouts.set(bufferKey, timeout);
	}
}
