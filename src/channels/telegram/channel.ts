/**
 * Telegram Channel — Bot API integration for synthtek
 */

import type {
	TelegramBotCommand,
	TelegramCallbackQuery,
	TelegramChannelInfo,
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

const API_BASE = "https://api.telegram.org/bot";
const TELEGRAM_MAX_MESSAGE_LEN = 4000;
const SEND_MAX_RETRIES = 3;
const SEND_RETRY_BASE_DELAY_MS = 500;
const STREAM_EDIT_INTERVAL_MS = 600;
const TYPING_REFRESH_INTERVAL_MS = 4000;
const MEDIA_GROUP_BUFFER_MS = 1000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Escape text for Telegram HTML parse mode */
function escapeTelegramHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

/** Render tool hints as an expandable blockquote (collapsed by default) */
function toolHintToTelegramBlockquote(text: string): string {
	return text
		? `<blockquote expandable>${escapeTelegramHtml(text)}</blockquote>`
		: "";
}

/** Strip markdown inline formatting from text */
function stripMd(s: string): string {
	let result = s;
	result = result.replace(/\*\*(.+?)\*\*/g, "$1");
	result = result.replace(/__(.+?)__/g, "$1");
	result = result.replace(/~~(.+?)~~/g, "$1");
	result = result.replace(/`([^`]+)`/g, "$1");
	return result.trim();
}

/**
 * Convert markdown to Telegram-safe HTML.
 * Handles code blocks, inline code, tables, headers, links, bold, italic, strikethrough, and lists.
 */
function markdownToTelegramHtml(text: string): string {
	if (!text) return "";

	// 1. Extract and protect code blocks
	const codeBlocks: string[] = [];
	const saveCodeBlock = (m: RegExpMatchArray): string => {
		codeBlocks.push(m[1]);
		return `\x00CB${codeBlocks.length - 1}\x00`;
	};
	let result = text.replace(/```[\w]*\n?([\s\S]*?)```/g, saveCodeBlock as any);

	// 1.5. Convert markdown tables to plain text (reuse code block placeholders)
	const lines = result.split("\n");
	const rebuilt: string[] = [];
	let i = 0;
	while (i < lines.length) {
		if (/^\s*\|.+\|/.test(lines[i])) {
			const table: string[] = [];
			while (i < lines.length && /^\s*\|.+\|/.test(lines[i])) {
				table.push(lines[i]);
				i++;
			}
			// Simple table rendering - just join with newlines
			const plain = table.map((l) => stripMd(l.trim())).join("\n");
			codeBlocks.push(plain);
			rebuilt.push(`\x00CB${codeBlocks.length - 1}\x00`);
		} else {
			rebuilt.push(lines[i]);
			i++;
		}
	}
	result = rebuilt.join("\n");

	// 2. Extract and protect inline code
	const inlineCodes: string[] = [];
	const saveInlineCode = (m: RegExpMatchArray): string => {
		inlineCodes.push(m[1]);
		return `\x00IC${inlineCodes.length - 1}\x00`;
	};
	result = result.replace(/`([^`]+)`/g, saveInlineCode as any);

	// 3. Headers # Title -> just the title text
	result = result.replace(/^#{1,6}\s+(.+)$/gm, "$1");

	// 4. Blockquotes > text -> just the text (before HTML escaping)
	result = result.replace(/^>\s*(.*)$/gm, "$1");

	// 5. Escape HTML special characters
	result = escapeTelegramHtml(result);

	// 6. Links [text](url) - must be before bold/italic to handle nested cases
	result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

	// 7. Bold **text** or __text__
	result = result.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
	result = result.replace(/__(.+?)__/g, "<b>$1</b>");

	// 8. Italic _text_ (avoid matching inside words like some_var_name)
	result = result.replace(
		/(?<![a-zA-Z0-9])_([^_]+)_(?![a-zA-Z0-9])/g,
		"<i>$1</i>",
	);

	// 9. Strikethrough ~~text~~
	result = result.replace(/~~(.+?)~~/g, "<s>$1</s>");

	// 10. Bullet lists - item -> • item
	result = result.replace(/^[-*]\s+/gm, "• ");

	// 11. Restore inline code with HTML tags
	for (let idx = 0; idx < inlineCodes.length; idx++) {
		const escaped = escapeTelegramHtml(inlineCodes[idx]);
		result = result.replace(`\x00IC${idx}\x00`, `<code>${escaped}</code>`);
	}

	// 12. Restore code blocks with HTML tags
	for (let idx = 0; idx < codeBlocks.length; idx++) {
		const escaped = escapeTelegramHtml(codeBlocks[idx]);
		result = result.replace(
			`\x00CB${idx}\x00`,
			`<pre><code>${escaped}</code></pre>`,
		);
	}

	return result;
}

/** Validate a URL target for safety (no internal/private IPs) */
function validateUrlTarget(url: string): [boolean, string] {
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return [false, "invalid protocol"];
		}
		// Block private/internal IPs
		const blockedHosts = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];
		if (blockedHosts.includes(parsed.hostname)) {
			return [false, "blocked host"];
		}
		return [true, ""];
	} catch {
		return [false, "invalid URL"];
	}
}

/** Guess media type from file extension */
function getMediaType(path: string): string {
	const ext = path.includes(".")
		? (path.split(".").pop()?.toLowerCase() ?? "")
		: "";
	if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "photo";
	if (ext === "ogg") return "voice";
	if (["mp3", "m4a", "wav", "aac"].includes(ext)) return "audio";
	return "document";
}

/** Check if a path is a remote media URL */
function isRemoteMediaUrl(path: string): boolean {
	return path.startsWith("http://") || path.startsWith("https://");
}

/** Convert Telegram update to our message format */
function parseMessage(update: any): TelegramMessage | null {
	const msg =
		update.message ||
		update.edited_message ||
		update.channel_post ||
		update.edited_channel_post;
	if (!msg) return null;

	let messageType: TelegramMessage["messageType"] = "text";
	if (msg.photo) messageType = "photo";
	else if (msg.document) messageType = "document";
	else if (msg.audio) messageType = "audio";
	else if (msg.video) messageType = "video";
	else if (msg.voice) messageType = "voice";
	else if (msg.sticker) messageType = "sticker";
	else if (msg.animation) messageType = "animation";

	return {
		messageId: msg.message_id,
		chatId: msg.chat.id,
		fromId: msg.from?.id,
		fromUsername: msg.from?.username,
		text: msg.text,
		entities: msg.entities,
		date: msg.date,
		replyToMessageId: msg.reply_to_message?.message_id,
		replyToMessage: msg.reply_to_message
			? {
					fromId: msg.reply_to_message.from?.id,
					fromUsername: msg.reply_to_message.from?.username,
					text: msg.reply_to_message.text,
					date: msg.reply_to_message.date,
				}
			: undefined,
		messageType,
		caption: msg.caption,
		fileId:
			msg.photo?.[msg.photo.length - 1]?.file_id ||
			msg.document?.file_id ||
			msg.video?.file_id,
		threadId: msg.is_topic_message ? msg.message_thread_id : undefined,
	};
}

/** Split text into chunks that fit Telegram's message length limit */
function splitMessage(
	text: string,
	maxLength = TELEGRAM_MAX_MESSAGE_LEN,
): string[] {
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

/** Normalize Telegram command (handle @username suffixes and alias mapping) */
function normalizeTelegramCommand(content: string): string {
	if (!content.startsWith("/")) return content;
	// Remove @username suffix
	const cleaned = content.replace(/@\w+$/u, "");
	// Map aliases
	if (cleaned === "/dream_log" || cleaned.startsWith("/dream_log ")) {
		return cleaned.replace("/dream_log", "/dream-log");
	}
	if (cleaned === "/dream_restore" || cleaned.startsWith("/dream_restore ")) {
		return cleaned.replace("/dream_restore", "/dream-restore");
	}
	return cleaned;
}

/** Check if a message is a command */
function isCommand(text: string): boolean {
	return /^\/\w+/.test(text);
}

/** Extract command name from message text */
function extractCommand(text: string): string | null {
	const match = text.match(/^\/(\w+(?:@\w+)?)/);
	return match ? normalizeTelegramCommand(match[1]) : null;
}

/** Check if a message mentions the bot (for group policy) */
function mentionsBot(
	text: string | undefined,
	botUsername: string | undefined,
): boolean {
	if (!text || !botUsername) return false;
	return text.includes(`@${botUsername}`);
}

/** Sleep for a given number of milliseconds */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

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

export class TelegramChannel {
	private config: Required<TelegramConfig>;
	private botUsername?: string;
	private botId?: number;
	private lastUpdateId = 0;
	private polling = false;
	private pollingInterval?: ReturnType<typeof setInterval>;
	private onMessage?: (message: TelegramMessage) => void;
	private onError?: (error: Error) => void;
	private typingTimeout?: ReturnType<typeof setTimeout>;
	private reconnectAttempts = 0;
	private started = false;

	// Advanced state
	private streamBuffers = new Map<number | string, TelegramStreamBuffer>();
	private typingTasks = new Map<
		number | string,
		ReturnType<typeof setInterval>
	>();
	private mediaGroupBuffers = new Map<
		number | string,
		TelegramMediaGroupBuffer
	>();
	private mediaGroupTimeouts = new Map<
		number | string,
		ReturnType<typeof setTimeout>
	>();
	private messageThreads = new Map<string, number>(); // "chatId:replyToMsgId" -> threadId
	private chatIds = new Map<string, number>(); // senderId -> chatId for replies
	private messagesReceived = 0;
	private messagesSent = 0;
	private mediaSent = 0;

	constructor(config: TelegramConfig) {
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
	async start(
		onMessage: (message: TelegramMessage) => void,
		onError?: (error: Error) => void,
	): Promise<void> {
		this.onMessage = onMessage;
		this.onError = onError;
		this.polling = true;
		this.started = true;

		// Get bot info
		await this.getBotInfo();

		// Register bot commands
		await this.registerBotCommands();

		// Start polling loop
		this.pollingLoop();
	}

	/** Stop long polling */
	async stop(): Promise<void> {
		this.started = false;
		this.polling = false;

		// Cancel all typing indicators
		for (const chatId of this.typingTasks.keys()) {
			this.stopTyping(chatId);
		}

		// Cancel all media group timeouts
		for (const timeout of this.mediaGroupTimeouts.values()) {
			clearTimeout(timeout);
		}
		this.mediaGroupTimeouts.clear();
		this.mediaGroupBuffers.clear();

		if (this.pollingInterval) {
			clearInterval(this.pollingInterval);
			this.pollingInterval = undefined;
		}
	}

	/** Register bot commands with Telegram */
	private async registerBotCommands(): Promise<void> {
		try {
			await this.apiCall("setMyCommands", {
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
			return mentionsBot(text, this.botUsername);
		}

		return true;
	}

	/** Get the bot's info */
	async getBotInfo(): Promise<{ username: string; id: number }> {
		const response = await this.apiCall("getMe");
		const data = (await response.json()) as {
			ok: boolean;
			result: { username: string; id: number };
		};

		if (!data.ok) {
			throw new Error(`Failed to get bot info: ${JSON.stringify(data)}`);
		}

		this.botUsername = data.result.username;
		this.botId = data.result.id;
		return data.result;
	}

	/** Get the bot's username */
	async getBotUsername(): Promise<string> {
		if (this.botUsername) return this.botUsername;
		const info = await this.getBotInfo();
		return info.username;
	}

	/** Get the bot's ID */
	async getBotId(): Promise<number | undefined> {
		if (this.botId) return this.botId;
		const info = await this.getBotInfo();
		return info.id;
	}

	// ─── Message Sending ─────────────────────────────────────────────────────

	/** Send a text message with retry logic */
	async sendMessage(
		chatId: number | string,
		text: string,
		options?: TelegramSendOptions,
	): Promise<Array<{ messageId: number }>> {
		const chunks = splitMessage(text, this.config.maxMessageLength);
		const results: Array<{ messageId: number }> = [];

		for (let i = 0; i < chunks.length; i++) {
			const response = await this.apiCallWithRetry("sendMessage", {
				chat_id: chatId,
				text: chunks[i],
				parse_mode: options?.parseMode,
				disable_web_page_preview: options?.disablePreviewLinks,
				protect_content: options?.protectContent,
				disable_notification: options?.disableNotification,
				allow_sending_without_reply: options?.allowSendingWithoutReply,
				...(options?.replyToMessageId !== undefined && i === 0
					? { reply_to_message_id: options.replyToMessageId }
					: {}),
				...(options?.messageThreadId !== undefined && i === 0
					? { message_thread_id: options.messageThreadId }
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
			this.messagesSent++;
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

			await this.apiCallWithRetry("sendMessage", {
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
			this.messagesSent++;
		} catch (error) {
			// Fallback to plain text
			console.warn(
				`[Telegram] HTML parse failed, falling back to plain text:`,
				error,
			);
			try {
				await this.apiCallWithRetry("sendMessage", {
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
				this.messagesSent++;
			} catch (fallbackError) {
				console.error(`[Telegram] Failed to send message:`, fallbackError);
			}
		}
	}

	/** Send an outbound message (integration with agent loop) */
	async sendOutboundMessage(msg: TelegramOutboundMessage): Promise<void> {
		if (!this.started) {
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

				if (isRemoteMediaUrl(mediaPath)) {
					const [ok, error] = validateUrlTarget(mediaPath);
					if (!ok) {
						throw new Error(`unsafe media URL: ${error}`);
					}
					await this.apiCallWithRetry(
						mediaType === "photo"
							? "sendPhoto"
							: mediaType === "voice"
								? "sendVoice"
								: mediaType === "audio"
									? "sendAudio"
									: "sendDocument",
						{
							chat_id: chatId,
							[mediaType === "photo" ? "photo" : mediaType]: mediaPath,
							reply_parameters: replyParams,
							...threadKwargs,
						},
					);
					this.mediaSent++;
					continue;
				}

				// Local file - in production, use FormData
				await this.apiCallWithRetry(
					mediaType === "photo"
						? "sendPhoto"
						: mediaType === "voice"
							? "sendVoice"
							: mediaType === "audio"
								? "sendAudio"
								: "sendDocument",
					{
						chat_id: chatId,
						[mediaType === "photo" ? "photo" : mediaType]: mediaPath,
						reply_parameters: replyParams,
						...threadKwargs,
					},
				);
				this.mediaSent++;
			} catch (error) {
				const filename = mediaPath.split("/").pop() ?? mediaPath;
				console.error(`[Telegram] Failed to send media ${mediaPath}:`, error);
				await this.apiCallWithRetry("sendMessage", {
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

		const response = await this.apiCall(method, body);
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

		const response = await this.apiCall("sendMediaAlbum", body);
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
			// Note: In production, use FormData for file uploads
			body[fileType] = file.data;
		} else {
			body[fileType] = file.data;
		}

		const response = await this.apiCall(method, body);
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
		const response = await this.apiCall("editMessageText", {
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
		const response = await this.apiCall("editMessageCaption", {
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
		const response = await this.apiCall("deleteMessage", {
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
		const response = await this.apiCall("pinChatMessage", {
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

		const response = await this.apiCall("unpinChatMessage", body);
		const data = (await response.json()) as { ok: boolean };
		return data.ok;
	}

	/** Unpin all messages in a topic/chat */
	async unpinAllMessages(chatId: number | string): Promise<boolean> {
		const response = await this.apiCall("unpinAllChatMessages", {
			chat_id: chatId,
		});
		const data = (await response.json()) as { ok: boolean };
		return data.ok;
	}

	// ─── Typing & Reactions ──────────────────────────────────────────────────

	/** Send a typing indicator with auto-refresh */
	async sendTyping(chatId: number | string, action = "typing"): Promise<void> {
		// Clear previous typing timeout
		if (this.typingTimeout) {
			clearTimeout(this.typingTimeout);
		}

		// Clear previous typing interval for this chat
		this.stopTyping(chatId);

		await this.apiCall("sendChatAction", {
			chat_id: chatId,
			action,
		});

		// Set up auto-refresh interval
		const interval = setInterval(async () => {
			try {
				await this.apiCall("sendChatAction", { chat_id: chatId, action });
			} catch {
				// Ignore errors in typing refresh
				this.stopTyping(chatId);
			}
		}, TYPING_REFRESH_INTERVAL_MS);
		this.typingTasks.set(chatId, interval);

		// Auto-stop after 30 seconds
		this.typingTimeout = setTimeout(() => {
			this.stopTyping(chatId);
		}, 30_000);
	}

	/** Stop typing indicator for a chat */
	stopTyping(chatId: number | string): void {
		const interval = this.typingTasks.get(chatId);
		if (interval) {
			clearInterval(interval);
			this.typingTasks.delete(chatId);
		}
		if (this.typingTimeout) {
			clearTimeout(this.typingTimeout);
			this.typingTimeout = undefined;
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
				await this.apiCallWithRetry("editMessageText", {
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
			await this.apiCallWithRetry("editMessageText", {
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
		const response = await this.apiCall("setMessageReaction", {
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
		const response = await this.apiCall("setMessageReaction", {
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
		const response = await this.apiCall("getMessageReactions", {
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
		const response = await this.apiCall("getChat", { chat_id: chatId });
		const data = (await response.json()) as { ok: boolean; result?: any };

		if (!data.ok || !data.result) return null;

		const chat = data.result;
		return {
			id: chat.id,
			type: chat.type,
			title: chat.title,
			username: chat.username,
			firstName: chat.first_name,
			lastName: chat.last_name,
			photo: chat.photo
				? {
						smallFileId: chat.photo.small_file_id,
						bigFileId: chat.photo.big_file_id,
					}
				: undefined,
			bio: chat.bio,
			description: chat.description,
			inviteLink: chat.invite_link,
			pinnedMessageId: chat.pinned_message?.message_id,
			permissions: chat.permissions
				? {
						canSendMessages: chat.permissions.can_send_messages,
						canSendMediaMessages: chat.permissions.can_send_media_messages,
						canSendPolls: chat.permissions.can_send_polls,
						canSendOtherMessages: chat.permissions.can_send_other_messages,
						canAddWebPagePreviews: chat.permissions.can_add_web_page_previews,
						canChangeInfo: chat.permissions.can_change_info,
						canInviteUsers: chat.permissions.can_invite_users,
						canPinMessages: chat.permissions.can_pin_messages,
						canManageTopics: chat.permissions.can_manage_topics,
					}
				: undefined,
			slowModeDelay: chat.slow_mode_delay,
			stickerSetName: chat.sticker_set_name,
			canSetStickerSet: chat.can_set_sticker_set,
			memberCount: chat.members_count,
		};
	}

	/** Get chat administrators */
	async getChatAdministrators(chatId: number | string): Promise<any[]> {
		const response = await this.apiCall("getChatAdministrators", {
			chat_id: chatId,
		});
		const data = (await response.json()) as { ok: boolean; result?: any[] };

		if (!data.ok) return [];
		return data.result ?? [];
	}

	/** Get chat member count */
	async getChatMemberCount(chatId: number | string): Promise<number> {
		const response = await this.apiCall("getChatMembersCount", {
			chat_id: chatId,
		});
		const data = (await response.json()) as { ok: boolean; result?: number };

		if (!data.ok) return 0;
		return data.result ?? 0;
	}

	/** Get a chat member's info */
	async getChatMember(
		chatId: number | string,
		userId: number,
	): Promise<any | null> {
		const response = await this.apiCall("getChatMember", {
			chat_id: chatId,
			user_id: userId,
		});
		const data = (await response.json()) as { ok: boolean; result?: any };

		if (!data.ok) return null;
		return data.result;
	}

	/** Leave a chat */
	async leaveChat(chatId: number | string): Promise<boolean> {
		const response = await this.apiCall("leaveChat", { chat_id: chatId });
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

		const response = await this.apiCall("banChatMember", body);
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

		const response = await this.apiCall("unbanChatMember", body);
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

		const response = await this.apiCall("restrictChatMember", body);
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
		const response = await this.apiCall("promoteChatMember", {
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
		const response = await this.apiCall("getUserProfilePhotos", {
			user_id: userId,
			offset: 0,
			limit: 1,
		});
		const data = (await response.json()) as {
			ok: boolean;
			result?: { total_count: number; photos: any[][] };
		};

		if (!data.ok) return null;

		// Also get user info via getChat
		const chatResponse = await this.apiCall("getChat", { chat_id: userId });
		const chatData = (await chatResponse.json()) as {
			ok: boolean;
			result?: any;
		};

		if (!chatData.ok) return null;

		const chat = chatData.result;
		return {
			id: chat.id,
			username: chat.username,
			firstName: chat.first_name,
			lastName: chat.last_name,
			photo: chat.photo
				? {
						smallFileId: chat.photo.small_file_id,
						bigFileId: chat.photo.big_file_id,
					}
				: undefined,
			bio: chat.bio,
			languageCode: chat.language_code,
			hasPrivateForwards: chat.has_private_forwards,
			hasRestrictedVoiceAndVideo: chat.has_restricted_voice_and_video,
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

		const response = await this.apiCall("setWebhook", body);
		const data = (await response.json()) as { ok: boolean };
		return data.ok;
	}

	/** Delete webhook (switch to polling) */
	async deleteWebhook(): Promise<boolean> {
		const response = await this.apiCall("deleteWebhook");
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
		const response = await this.apiCall("getWebhookInfo");
		const data = (await response.json()) as { ok: boolean; result?: any };

		if (!data.ok || !data.result) return null;

		return {
			url: data.result.url,
			hasCustomCertificate: data.result.has_custom_certificate,
			pendingUpdateCount: data.result.pending_update_count,
			lastErrorDate: data.result.last_error_date,
			errorMessage: data.result.last_error_message,
		};
	}

	// ─── Utilities ───────────────────────────────────────────────────────────

	/** Get file download URL */
	async getFileUrl(fileId: string): Promise<string> {
		const response = await this.apiCall("getFile", { file_id: fileId });
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

		const response = await this.apiCall("copyMessage", body);
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
		const response = await this.apiCall("forwardMessage", {
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
			const response = await this.apiCall("getMe");
			const data = (await response.json()) as { ok: boolean };
			return data.ok;
		} catch {
			return false;
		}
	}

	/** Get client stats */
	getStats(): TelegramStats {
		return {
			polling: this.polling,
			lastUpdateId: this.lastUpdateId,
			messagesReceived: this.messagesReceived,
			messagesSent: this.messagesSent,
			mediaSent: this.mediaSent,
			activeStreams: this.streamBuffers.size,
			activeTyping: this.typingTasks.size,
			connectedChats: this.chatIds.size,
		};
	}

	// ── Private helpers ────────────────────────────────────────────────────────

	private async pollingLoop(): Promise<void> {
		while (this.polling && this.started) {
			try {
				const updates = await this.getUpdates();

				for (const update of updates) {
					// Skip old updates
					if (update.update_id <= this.lastUpdateId) continue;
					this.lastUpdateId = update.update_id;

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

					this.messagesReceived++;

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
					if (this.onMessage) {
						this.onMessage(message);
					}
				}
			} catch (error) {
				this.reconnectAttempts++;
				console.error(
					`[Telegram] Polling error (attempt ${this.reconnectAttempts}):`,
					error,
				);

				if (this.onError) {
					this.onError(
						error instanceof Error ? error : new Error(String(error)),
					);
				}

				// Wait before retrying with exponential backoff
				const delay = Math.min(
					this.config.retryDelay * 1.5 ** this.reconnectAttempts,
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
		if (this.onMessage) {
			this.onMessage(message);
		}
	}

	/** Handle callback queries (inline buttons, etc.) */
	private async handleCallbackQuery(
		query: TelegramCallbackQuery,
	): Promise<void> {
		try {
			// Answer callback query
			await this.apiCall("answerCallbackQuery", {
				callback_query_id: query.id,
			});

			// Forward to message handler if there's data
			if (query.data && this.onMessage) {
				this.onMessage({
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
			await this.apiCall("answerInlineQuery", {
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
		const existing = this.mediaGroupBuffers.get(bufferKey);

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
		this.mediaGroupBuffers.set(bufferKey, buffer);

		// Set timeout to flush buffer
		const timeout = setTimeout(() => {
			this.mediaGroupBuffers.delete(bufferKey);
		}, MEDIA_GROUP_BUFFER_MS);
		this.mediaGroupTimeouts.set(bufferKey, timeout);
	}

	private async getUpdates(): Promise<any[]> {
		const params = new URLSearchParams({
			offset: String(this.lastUpdateId + 1),
			timeout: String(this.config.pollingTimeout),
			limit: "100",
		});

		const response = await this.apiCall(`getUpdates?${params}`);
		const data = (await response.json()) as { ok: boolean; result: any[] };

		if (!data.ok) {
			throw new Error(`Failed to get updates: ${JSON.stringify(data)}`);
		}

		return data.result;
	}

	/** API call with retry logic (exponential backoff) */
	private async apiCallWithRetry(
		method: string,
		body?: Record<string, unknown>,
	): Promise<Response> {
		for (let attempt = 1; attempt <= SEND_MAX_RETRIES; attempt++) {
			try {
				return await this.apiCall(method, body);
			} catch (error: any) {
				// Check for rate limiting / flood control
				const isRateLimited =
					error.message?.includes("429") || error.message?.includes("flood");
				if (isRateLimited && attempt < SEND_MAX_RETRIES) {
					const delay = SEND_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
					console.warn(
						`[Telegram] Rate limited (attempt ${attempt}/${SEND_MAX_RETRIES}), retrying in ${delay}ms`,
					);
					await sleep(delay);
					continue;
				}
				// Check for timeout
				const isTimeout =
					error.name === "AbortError" || error.message?.includes("timeout");
				if (isTimeout && attempt < SEND_MAX_RETRIES) {
					const delay = SEND_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
					console.warn(
						`[Telegram] Timeout (attempt ${attempt}/${SEND_MAX_RETRIES}), retrying in ${delay}ms`,
					);
					await sleep(delay);
					continue;
				}
				throw error;
			}
		}
		throw new Error(`Failed after ${SEND_MAX_RETRIES} retries`);
	}

	private async apiCall(
		method: string,
		body?: Record<string, unknown>,
	): Promise<Response> {
		const url = `${API_BASE}${this.config.token}/${method}`;

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 30_000);

		try {
			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: body ? JSON.stringify(body) : undefined,
				signal: controller.signal,
			});

			clearTimeout(timeout);
			return response;
		} catch (error) {
			clearTimeout(timeout);
			throw error;
		}
	}
}
