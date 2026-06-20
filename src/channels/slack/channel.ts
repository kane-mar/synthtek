/**
 * Slack Channel — Slack Web API integration for synthtek
 */

import { BaseChannel } from "../base-channel.js";
import type {
	SlackAttachment,
	SlackBlockKit,
	SlackBlockMessage,
	SlackChannelInfo,
	SlackConfig,
	SlackFile,
	SlackMessage,
	SlackReaction,
	SlackSendOptions,
	SlackTeamInfo,
	SlackUploadOptions,
	SlackUploadResult,
	SlackUserInfo,
} from "./types.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a Slack event message to our unified format */
function parseMessage(event: any): SlackMessage {
	const isBotMessage = !!(event.bot_id || event.type === "bot_message");
	const files = (event.files || []).map((f: any) => ({
		id: f.id,
		name: f.name || "",
		mimetype: f.mimetype || "",
		size: f.size || 0,
		url: f.url_private || f.permalink || "",
	}));

	const imageUrls = files
		.filter((f: any) => f.mimetype.startsWith("image/"))
		.map((f: any) => f.url);

	return {
		messageId: event.ts,
		channelId: event.channel,
		threadTs: event.thread_ts || undefined,
		fromId: event.user || event.bot_id || "",
		fromUsername: event.user || undefined,
		fromName: event.username || undefined,
		text: event.text || "",
		isBotMessage,
		ts: event.ts,
		messageType: event.type as SlackMessage["messageType"],
		files,
		imageUrls,
		replyToTs: event.reply_to || undefined,
		parentUserId: event.parent_user_id || undefined,
		channelType: event.channel_type || "unknown",
		isEdited: !!event.edited,
		editedTs: event.edited ? String(event.edited) : undefined,
	};
}

/** Split long messages for Slack's 4000 char limit */
function splitMessage(text: string, maxLen = 4000): string[] {
	if (text.length <= maxLen) return [text];
	const chunks: string[] = [];
	let remaining = text;
	while (remaining.length > 0) {
		if (remaining.length <= maxLen) {
			chunks.push(remaining);
			break;
		}
		let splitIdx = remaining.lastIndexOf("\n", maxLen);
		if (splitIdx === -1) splitIdx = maxLen;
		chunks.push(remaining.slice(0, splitIdx));
		remaining = remaining.slice(splitIdx).trimStart();
	}
	return chunks;
}

/** Build a Block Kit message from text */
function buildBlockMessage(
	text: string,
	options?: SlackSendOptions,
): SlackBlockMessage {
	const blocks: SlackBlockKit[] = [
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: text.slice(0, 3000),
			},
		},
	];

	return {
		blocks,
		text: text.slice(0, 2000),
		reply_broadcast: options?.replyBroadcast,
		thread_ts: options?.threadTs,
		unfurl_links: options?.unfurlLinks,
		unfurl_media: options?.unfurlMedia,
	};
}

// ─── Slack Channel ───────────────────────────────────────────────────────────

export class SlackChannel extends BaseChannel<SlackConfig, SlackMessage> {
	private token: string;
	private botUserId?: string;
	private typingTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
	private reconnectCount = 0;

	constructor(config: SlackConfig) {
		super(config);
		this.token = config.token;
		this.botUserId = config.botUserId;
	}

	/** HTTP header for API calls */
	private headers(): Record<string, string> {
		return {
			Authorization: `Bearer ${this.token}`,
			"Content-Type": "application/json",
		};
	}

	/** Make an authenticated API call */
	private async apiCall<T = any>(
		endpoint: string,
		method = "POST",
		body?: Record<string, unknown>,
	): Promise<T> {
		let url = `https://slack.com/api/${endpoint}`;

		if (method === "GET" && body) {
			const params = new URLSearchParams();
			for (const [k, v] of Object.entries(body)) {
				if (v !== undefined) params.append(k, String(v));
			}
			const qs = params.toString();
			if (qs) url += `?${qs}`;
		}

		const response = await fetch(url, {
			method,
			headers: this.headers(),
			body: method !== "GET" && body ? JSON.stringify(body) : undefined,
		});

		const data = await response.json();

		if (!data.ok) {
			const error = new Error(`Slack API error: ${data.error}`);
			this.emitError(error, true);
			throw error;
		}

		return data;
	}

	/** Start the Slack channel (alias for connect) */
	async start(): Promise<void> {
		await this.connect();
	}

	/** Connect to Slack */
	async connect(): Promise<void> {
		const auth = await this.apiCall("auth.test");
		this.botUserId = this.botUserId || auth.user_id;
		this.markConnected();
		this.reconnectCount = 0;
	}

	/** Stop the Slack channel (alias for disconnect) */
	async stop(): Promise<void> {
		await this.disconnect();
	}

	/** Disconnect from Slack */
	async disconnect(): Promise<void> {
		this.markDisconnected();
		for (const [, timer] of this.typingTimers) {
			clearTimeout(timer);
		}
		this.typingTimers.clear();
	}

	/** Process an incoming Slack event */
	async processEvent(event: any): Promise<void> {
		if (event.type !== "message") return;
		if (event.subtype && event.subtype !== "thread_broadcast") return;

		const message = parseMessage(event);

		if (message.fromId === this.botUserId) return;

		await this.dispatchMessage(message);
	}

	/** Send a message to a channel */
	async sendMessage(
		channelId: string,
		text: string,
		options?: SlackSendOptions,
	): Promise<string[]> {
		const sentIds: string[] = [];
		const chunks = splitMessage(text);

		for (const chunk of chunks) {
			const blockMsg = buildBlockMessage(chunk, options);
			const result = await this.apiCall("chat.postMessage", "POST", {
				channel: options?.channel || channelId,
				...blockMsg,
			});

			sentIds.push(result.ts);
			this.recordSent();
		}

		return sentIds;
	}

	/** Send a message with Block Kit blocks */
	async sendBlockMessage(
		channelId: string,
		blocks: SlackBlockKit[],
		options?: SlackSendOptions,
	): Promise<string> {
		const fallbackText =
			(blocks as any).find((b: any) => b.type === "section")?.text?.text || "";

		const result = await this.apiCall("chat.postMessage", "POST", {
			channel: options?.channel || channelId,
			blocks,
			text: fallbackText,
			thread_ts: options?.threadTs,
			reply_broadcast: options?.replyBroadcast,
		});

		this.recordSent();
		return result.ts;
	}

	/** Send a message with attachments */
	async sendAttachment(
		channelId: string,
		attachments: SlackAttachment[],
		options?: SlackSendOptions,
	): Promise<string> {
		const result = await this.apiCall("chat.postMessage", "POST", {
			channel: options?.channel || channelId,
			attachments,
			thread_ts: options?.threadTs,
		});

		this.recordSent();
		return result.ts;
	}

	/** Update an existing message */
	async updateMessage(
		channelId: string,
		timestamp: string,
		text: string,
	): Promise<void> {
		await this.apiCall("chat.update", "POST", {
			channel: channelId,
			ts: timestamp,
			text,
		});
	}

	/** Delete a message */
	async deleteMessage(channelId: string, timestamp: string): Promise<void> {
		await this.apiCall("chat.delete", "POST", {
			channel: channelId,
			ts: timestamp,
		});
	}

	/** Add a reaction to a message */
	async addReaction(
		channelId: string,
		timestamp: string,
		reaction: string,
	): Promise<void> {
		await this.apiCall("reactions.add", "POST", {
			channel: channelId,
			timestamp,
			name: reaction,
		});
	}

	/** Remove a reaction from a message */
	async removeReaction(
		channelId: string,
		timestamp: string,
		reaction: string,
	): Promise<void> {
		await this.apiCall("reactions.remove", "POST", {
			channel: channelId,
			timestamp,
			name: reaction,
		});
	}

	/** Get reactions for a message */
	async getReactions(
		channelId: string,
		timestamp: string,
	): Promise<SlackReaction[]> {
		const result = await this.apiCall("reactions.get", "GET", {
			channel: channelId,
			timestamp,
		});

		return (result.items?.[0]?.reactions || []).map((r: any) => ({
			name: r.name,
			count: r.users?.length || 0,
			users: r.users || [],
			me: r.users?.includes(this.botUserId || ""),
		}));
	}

	/** Show typing indicator */
	async showTyping(channelId: string, threadTs?: string): Promise<void> {
		const key = `${channelId}:${threadTs || ""}`;
		const existing = this.typingTimers.get(key);
		if (existing) clearTimeout(existing);

		await this.apiCall("chat.postEphemeral", "POST", {
			channel: channelId,
			user: this.botUserId || "",
			text: "",
			thread_ts: threadTs,
		}).catch(() => {
			// Typing indicators are best-effort
		});

		this.typingTimers.set(
			key,
			setTimeout(() => {
				this.typingTimers.delete(key);
			}, 3000),
		);
	}

	/** Get channel info */
	async getChannelInfo(channelId: string): Promise<SlackChannelInfo> {
		const result = await this.apiCall("conversations.info", "POST", {
			channel: channelId,
		});

		const ch = result.channel;
		return {
			id: ch.id,
			name: ch.name || "",
			type: ch.is_im
				? "im"
				: ch.is_mpim
					? "mpim"
					: ch.is_channel
						? "channel"
						: ch.is_group
							? "group"
							: "unknown",
			isPrivate: ch.is_private || false,
			isChannel: ch.is_channel || false,
			isGroup: ch.is_group || false,
			isIm: ch.is_im || false,
			isMpim: ch.is_mpim || false,
			nameNormalized: ch.name_normalized || "",
			created: ch.created || 0,
			creator: ch.creator || "",
			isExtShared: ch.is_ext_shared || false,
			isShared: ch.is_shared || false,
			isOrgShared: ch.is_org_shared || false,
			pendingShared: ch.pending_shared || false,
			unreadCount: ch.unread_count || 0,
			unreadCountTs: ch.unread_count_ts || "0",
			general: ch.is_general || false,
			archived: ch.is_archived || false,
			priority: ch.priority || 0,
			topic: ch.topic,
			purpose: ch.purpose,
			previousNames: ch.previous_names,
			numMembers: ch.num_members,
		};
	}

	/** List conversations */
	async listConversations(
		types?: string[],
		cursor?: string,
		limit = 100,
	): Promise<{ channels: SlackChannelInfo[]; nextCursor: string }> {
		const result = await this.apiCall("conversations.list", "POST", {
			types: types?.join(","),
			cursor,
			limit,
		});

		return {
			channels: result.channels.map((ch: any) => ({
				id: ch.id,
				name: ch.name || "",
				type: ch.is_im
					? "im"
					: ch.is_mpim
						? "mpim"
						: ch.is_channel
							? "channel"
							: ch.is_group
								? "group"
								: "unknown",
				isPrivate: ch.is_private || false,
				isChannel: ch.is_channel || false,
				isGroup: ch.is_group || false,
				isIm: ch.is_im || false,
				isMpim: ch.is_mpim || false,
				nameNormalized: ch.name_normalized || "",
				created: ch.created || 0,
				creator: ch.creator || "",
				isExtShared: false,
				isShared: false,
				isOrgShared: false,
				pendingShared: false,
				unreadCount: 0,
				unreadCountTs: "0",
				general: false,
				archived: ch.is_archived || false,
				priority: 0,
			})),
			nextCursor: result.response_metadata?.next_cursor || "",
		};
	}

	/** Get user info */
	async getUserInfo(userId: string): Promise<SlackUserInfo> {
		const result = await this.apiCall("users.info", "POST", {
			user: userId,
		});

		const user = result.user;
		return {
			id: user.id,
			username: user.name || "",
			name: user.name || "",
			realName: user.profile?.real_name || user.real_name || "",
			tz: user.tz,
			tzLabel: user.tz_label,
			tzOffset: user.tz_offset,
			profile: user.profile,
			isAdmin: user.is_admin || false,
			isOwner: user.is_owner || false,
			isPrimaryOwner: user.is_primary_owner || false,
			isRestricted: user.is_restricted || false,
			isUltraRestricted: user.is_ultra_restricted || false,
			isBot: user.is_bot || false,
			isAppUser: user.is_app_user || false,
			updated: user.updated || 0,
			email: user.profile?.email,
			teamId: user.team_id || "",
		};
	}

	/** Get team info */
	async getTeamInfo(): Promise<SlackTeamInfo> {
		const result = await this.apiCall("team.info");
		const team = result.team;
		return {
			id: team.id,
			name: team.name || "",
			domain: team.domain || "",
			emailDomain: team.email_domain || "",
			icon: team.icon || { imageOriginal: "", imageDefault: "" },
		};
	}

	/** Upload a file */
	async uploadFile(
		fileUrl: string,
		options: SlackUploadOptions,
	): Promise<SlackUploadResult> {
		try {
			const response = await fetch(fileUrl);
			const buffer = Buffer.from(await response.arrayBuffer());

			const result = await this.apiCall("files.uploadv2", "POST", {
				channels: options.channels?.join(","),
				filename: options.filename || fileUrl.split("/").pop() || "file",
				title: options.title,
				initial_comment: options.initialComment,
				thread_ts: options.threadTs,
				content: buffer.toString("base64"),
			});

			return {
				ok: true,
				file: result.file,
			};
		} catch (err) {
			return {
				ok: false,
				error: err instanceof Error ? err.message : "Unknown error",
			};
		}
	}

	/** Get file info */
	async getFile(fileId: string): Promise<SlackFile> {
		const result = await this.apiCall("files.info", "POST", {
			file: fileId,
		});
		return result.file;
	}

	/** Get health check status */
	async healthCheckSlack(): Promise<{
		ok: boolean;
		connected: boolean;
		stats: Record<string, number>;
	}> {
		try {
			await this.apiCall("auth.test");
			return {
				ok: true,
				connected: this.isConnected(),
				stats: this.getSlackStats(),
			};
		} catch {
			return {
				ok: false,
				connected: false,
				stats: this.getSlackStats(),
			};
		}
	}

	/** Get Slack-specific stats (backward compatible) */
	getSlackStats(): Record<string, number> {
		const base = this.getStats();
		return {
			messagesSent: base.messagesSent,
			messagesReceived: base.messagesReceived,
			errors: this.errorCount,
			reconnects: this.reconnectCount,
		};
	}
}
