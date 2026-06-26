/**
 * Telegram Formatting Helpers
 * Extracted formatting, parsing, and utility functions for Telegram Bot API integration.
 */

import type { TelegramMessage } from "./types.js";

/** Default maximum message length for Telegram */
export const TELEGRAM_MAX_MESSAGE_LEN = 4000;

/** Map Telegram media types to their send API method names */
export const MEDIA_SEND_METHODS: Record<string, string> = {
	photo: "sendPhoto",
	voice: "sendVoice",
	audio: "sendAudio",
	video: "sendVideo",
	animation: "sendAnimation",
	document: "sendDocument",
};

// ─── HTML Escaping ────────────────────────────────────────────────────────────

/** Escape text for Telegram HTML parse mode */
export function escapeTelegramHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

/** Render tool hints as an expandable blockquote (collapsed by default) */
export function toolHintToTelegramBlockquote(text: string): string {
	return text
		? `<blockquote expandable>${escapeTelegramHtml(text)}</blockquote>`
		: "";
}

// ─── Markdown Utilities ──────────────────────────────────────────────────────

/** Strip markdown inline formatting from text */
export function stripMd(s: string): string {
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
export function markdownToTelegramHtml(text: string): string {
	if (!text) return "";

	// 1. Extract and protect code blocks
	const codeBlocks: string[] = [];
	const saveCodeBlock = (_match: string, code: string): string => {
		codeBlocks.push(code);
		return `\x00CB${codeBlocks.length - 1}\x00`;
	};
	let result = text.replace(/```[\w]*\n?([\s\S]*?)```/g, saveCodeBlock);

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
	const saveInlineCode = (_match: string, code: string): string => {
		inlineCodes.push(code);
		return `\x00IC${inlineCodes.length - 1}\x00`;
	};
	result = result.replace(/`([^`]+)`/g, saveInlineCode);

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

// ─── URL Validation ──────────────────────────────────────────────────────────

/** Validate a URL target for safety (no internal/private IPs) */
export function validateUrlTarget(url: string): [boolean, string] {
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

// ─── Media Type Detection ────────────────────────────────────────────────────

/** Guess media type from file extension */
export function getMediaType(path: string): string {
	const ext = path.includes(".")
		? (path.split(".").pop()?.toLowerCase() ?? "")
		: "";
	if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "photo";
	if (ext === "ogg") return "voice";
	if (["mp3", "m4a", "wav", "aac"].includes(ext)) return "audio";
	return "document";
}

/** Check if a path is a remote media URL */
export function isRemoteMediaUrl(path: string): boolean {
	return path.startsWith("http://") || path.startsWith("https://");
}

// ─── Message Parsing ─────────────────────────────────────────────────────────

/**
 * Minimal Telegram API types for internal parsing.
 * Full definitions ship with the Telegram Bot API types package.
 */

/** Minimal Telegram Update type for message parsing */
export interface TelegramUpdate {
	message?: TelegramRawMessage;
	edited_message?: TelegramRawMessage;
	channel_post?: TelegramRawMessage;
	edited_channel_post?: TelegramRawMessage;
	callback_query?: {
		id: string;
		from: { id: number; username?: string };
		message?: TelegramRawMessage;
		data?: string;
	};
	inline_query?: unknown;
}

export interface TelegramRawMessage {
	message_id: number;
	chat: { id: number; type?: string };
	from?: { id: number; username?: string };
	text?: string;
	caption?: string;
	entities?: Array<{ type: string; offset: number; length: number }>;
	date: number;
	photo?: Array<{ file_id: string }>;
	document?: { file_id: string };
	audio?: { file_id: string };
	video?: { file_id: string };
	voice?: { file_id: string };
	sticker?: { file_id: string };
	animation?: { file_id: string };
	reply_to_message?: {
		message_id: number;
		from?: { id: number; username?: string };
		text?: string;
		date: number;
	};
	is_topic_message?: boolean;
	message_thread_id?: number;
}

/** Convert Telegram update to our message format */
export function parseMessage(update: TelegramUpdate): TelegramMessage | null {
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

// ─── Message Splitting ───────────────────────────────────────────────────────

/** Split text into chunks that fit Telegram's message length limit */
export function splitMessage(
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

// ─── Command Utilities ───────────────────────────────────────────────────────

/** Normalize Telegram command (handle @username suffixes and alias mapping) */
export function normalizeTelegramCommand(content: string): string {
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
export function isCommand(text: string): boolean {
	return /^\/\w+/.test(text);
}

/** Extract command name from message text */
export function extractCommand(text: string): string | null {
	const match = text.match(/^\/(\w+(?:@\w+)?)/);
	return match ? normalizeTelegramCommand(match[1]) : null;
}

/** Check if a message mentions the bot (for group policy) */
export function mentionsBot(
	text: string | undefined,
	botUsername: string | undefined,
): boolean {
	if (!text || !botUsername) return false;
	return text.includes(`@${botUsername}`);
}

// ─── Misc Utilities ──────────────────────────────────────────────────────────

/** Sleep for a given number of milliseconds */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
