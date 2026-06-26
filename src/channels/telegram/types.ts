/**
 * Telegram Channel — Bot API integration for synthtek
 */

import type { StreamBuffer } from "../../performance/types.js";

export type TelegramGroupPolicy = "open" | "mention";

export interface TelegramConfig {
	/** Bot token from BotFather */
	token: string;
	/** Webhook URL (optional, for webhook mode) */
	webhookUrl?: string;
	/** Long polling timeout in seconds */
	pollingTimeout?: number;
	/** Maximum connection retries */
	maxRetries?: number;
	/** Retry delay in milliseconds */
	retryDelay?: number;
	/** Whether to enable long polling */
	usePolling?: boolean;
	/** Webhook secret token */
	webhookSecretToken?: string;
	/** Allowed updates types */
	allowedUpdates?: string[];
	/** Allowed sender IDs (user IDs or usernames) - empty means allow all */
	allowFrom?: string[];
	/** Proxy URL for API requests */
	proxy?: string;
	/** Whether to reply to user messages */
	replyToMessage?: boolean;
	/** Emoji to react with on incoming messages */
	reactEmoji?: string;
	/** Group policy: 'open' (all messages) or 'mention' (only bot mentions) */
	groupPolicy?: TelegramGroupPolicy;
	/** Connection pool size for API requests */
	connectionPoolSize?: number;
	/** Pool timeout in seconds */
	poolTimeout?: number;
	/** Enable streaming responses with progressive editing */
	streaming?: boolean;
	/** Maximum message length for Telegram (default 4000) */
	maxMessageLength?: number;
}

export interface TelegramMessage {
	/** Message ID */
	messageId: number;
	/** Chat ID */
	chatId: number | string;
	/** Sender user ID */
	fromId?: number;
	/** Sender username */
	fromUsername?: string;
	/** Message text */
	text?: string;
	/** Message entities (bold, italic, links, etc.) */
	entities?: Array<{
		type: string;
		offset: number;
		length: number;
	}>;
	/** Message date (Unix timestamp) */
	date: number;
	/** Reply to message ID */
	replyToMessageId?: number;
	/** Reply to message sender */
	replyToMessage?: {
		fromId?: number;
		fromUsername?: string;
		text?: string;
		date: number;
	};
	/** Message type */
	messageType:
		| "text"
		| "photo"
		| "document"
		| "audio"
		| "video"
		| "voice"
		| "sticker"
		| "animation"
		| "unknown";
	/** Caption for media messages */
	caption?: string;
	/** Media file ID */
	fileId?: string;
	/** Thread/topic ID (for forum topics) */
	threadId?: number;
}

export interface TelegramUpdate {
	/** Update ID */
	updateId: number;
	/** Message (if update contains a message) */
	message?: TelegramMessage;
	/** Edited message */
	editedMessage?: TelegramMessage;
	/** Channel post */
	channelPost?: TelegramMessage;
	/** Edited channel post */
	editedChannelPost?: TelegramMessage;
	/** Callback query */
	callbackQuery?: {
		id: string;
		fromId: number;
		chatInstance: string;
		data?: string;
		inlineMessageId?: string;
	};
	/** Inline query */
	inlineQuery?: {
		id: string;
		fromId: number;
		query: string;
		offset: string;
	};
}

export interface TelegramSendOptions {
	/** Reply to message ID */
	replyToMessageId?: number;
	/** Disable preview links */
	disablePreviewLinks?: boolean;
	/** Parse mode (HTML, Markdown, MarkdownV2) */
	parseMode?: "HTML" | "Markdown" | "MarkdownV2";
	/** Protect content from forwarding */
	protectContent?: boolean;
	/** Message thread ID (for forum topics) */
	messageThreadId?: number;
	/** Disable notification */
	disableNotification?: boolean;
	/** Allow sending without reply */
	allowSendingWithoutReply?: boolean;
}

export interface TelegramMedia {
	/** Media type */
	type: "photo" | "document" | "audio" | "video" | "animation";
	/** File ID or URL */
	media: string;
	/** Caption */
	caption?: string;
	/** Parse mode */
	parseMode?: "HTML" | "Markdown" | "MarkdownV2";
	/** Thumbnail file ID */
	thumb?: string;
}

export interface TelegramTypingIndicator {
	/** Action type */
	action:
		| "typing"
		| "upload_photo"
		| "record_video"
		| "upload_video"
		| "record_audio"
		| "upload_audio"
		| "upload_document"
		| "choose_sticker";
}

export interface TelegramChannelInfo {
	id: number;
	type: "private" | "group" | "supergroup" | "channel";
	title?: string;
	username?: string;
	firstName?: string;
	lastName?: string;
	photo?: { smallFileId: string; bigFileId: string };
	bio?: string;
	description?: string;
	inviteLink?: string;
	pinnedMessageId?: number;
	permissions?: {
		canSendMessages?: boolean;
		canSendMediaMessages?: boolean;
		canSendPolls?: boolean;
		canSendOtherMessages?: boolean;
		canAddWebPagePreviews?: boolean;
		canChangeInfo?: boolean;
		canInviteUsers?: boolean;
		canPinMessages?: boolean;
		canManageTopics?: boolean;
	};
	slowModeDelay?: number;
	stickerSetName?: string;
	canSetStickerSet?: boolean;
	memberCount?: number;
}

export interface TelegramUserInfo {
	id: number;
	username?: string;
	firstName?: string;
	lastName?: string;
	photo?: { smallFileId: string; bigFileId: string };
	bio?: string;
	languageCode?: string;
	hasPrivateForwards?: boolean;
	hasRestrictedVoiceAndVideo?: boolean;
	totalPhotos?: number;
}

export interface TelegramReaction {
	emoji: string;
	type: string;
	count: number;
	isPersonal: boolean;
}

// ─── Streaming ───────────────────────────────────────────────────────────────

/** Stream buffer for Telegram streaming output */
export type TelegramStreamBuffer = StreamBuffer<number>;

// ─── Reply Context ───────────────────────────────────────────────────────────

export interface TelegramReplyContext {
	/** Message ID to reply to */
	messageId: number;
	/** Thread ID for forum topics */
	threadId?: number;
	/** Sender user ID */
	fromId: number;
	/** Sender username */
	fromUsername?: string;
	/** Original message text (truncated) */
	text?: string;
}

// ─── Inline Query ────────────────────────────────────────────────────────────

export interface TelegramInlineQuery {
	/** Query ID */
	id: string;
	/** User ID */
	fromId: number;
	/** Query text */
	query: string;
	/** Offset */
	offset: string;
	/** Location (optional) */
	location?: {
		latitude: number;
		longitude: number;
		horizontalAccuracy?: number;
	};
}

export interface TelegramInlineQueryResult {
	/** Result type */
	type:
		| "article"
		| "photo"
		| "gif"
		| "mpeg4_gif"
		| "video"
		| "audio"
		| "document"
		| "location"
		| "venue";
	/** Unique result ID */
	id: string;
	/** Title */
	title?: string;
	/** Input message content */
	inputMessageContent?: {
		message_text: string;
		parse_mode?: "HTML" | "Markdown";
		disable_web_page_preview?: boolean;
	};
	/** URL for photo/gif/video results */
	url?: string;
	/** Thumbnail URL */
	thumbnailUrl?: string;
	/** Description */
	description?: string;
}

// ─── Callback Query ──────────────────────────────────────────────────────────

export interface TelegramCallbackQuery {
	/** Callback query ID */
	id: string;
	/** User */
	from: {
		id: number;
		username?: string;
		firstName?: string;
	};
	/** Message */
	message: {
		messageId: number;
		chat: {
			id: number | string;
			type: "private" | "group" | "supergroup" | "channel";
		};
	};
	/** Chat instance */
	chatInstance: string;
	/** Data */
	data?: string;
	/** Inline message ID */
	inlineMessageId?: string;
}

// ─── Bot Command ─────────────────────────────────────────────────────────────

export interface TelegramBotCommand {
	/** Command name */
	command: string;
	/** Command description */
	description: string;
}

// ─── Outbound Message (for integration with agent loop) ──────────────────────

export interface TelegramOutboundMessage {
	/** Chat ID to send to */
	chatId: number | string;
	/** Message content */
	content: string;
	/** Media file paths */
	media?: string[];
	/** Metadata */
	metadata: {
		/** Original message ID to reply to */
		message_id?: number;
		/** Thread ID for forum topics */
		message_thread_id?: number;
		/** Whether this is a progress update (not final) */
		_progress?: boolean;
		/** Whether to render as tool hint blockquote */
		_tool_hint?: boolean;
	};
}

// ─── Media Group Buffer ──────────────────────────────────────────────────────

export interface TelegramMediaGroupBuffer {
	/** Media items accumulated */
	items: Array<{
		type: "photo" | "document" | "audio" | "video";
		media: string;
		caption?: string;
	}>;
	/** Chat ID */
	chatId: number | string;
	/** Timeout in ms */
	timeout: number;
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export interface TelegramStats {
	/** Whether the channel is connected */
	connected: boolean;
	/** Whether polling is active */
	polling: boolean;
	/** Last processed update ID */
	lastUpdateId: number;
	/** Total messages received */
	messagesReceived: number;
	/** Total messages sent */
	messagesSent: number;
	/** Total errors */
	errors?: number;
	/** Timestamp of last activity */
	lastActivity?: number;
	/** Total media sent */
	mediaSent: number;
	/** Active stream buffers */
	activeStreams: number;
	/** Active typing indicators */
	activeTyping: number;
	/** Connected chat count */
	connectedChats: number;
}
