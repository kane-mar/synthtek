/**
 * Discord Channel — Discord.js integration for synthtek
 */

import type { StreamBuffer } from "../types.js";

// ─── Config ──────────────────────────────────────────────────────────────────

export interface DiscordConfig {
	/** Bot token from Discord developer portal */
	token: string;
	/** Client ID for OAuth2 interactions */
	clientId?: string;
	/** Guild ID(s) to limit bot to (optional) */
	guildIds?: string[];
	/** Whether to use gateway intents */
	intents?: string[];
	/** Reconnect delay in milliseconds */
	reconnectDelay?: number;
	/** Maximum reconnection attempts (0 = infinite) */
	maxReconnectAttempts?: number;
	/** Presence update interval in ms (0 = disabled) */
	presenceInterval?: number;
	/** Admin user IDs (for admin-only commands) */
	adminIds?: string[];
	/** Whether to enable slash commands */
	slashCommands?: boolean;
	/** Whether to enable reactions */
	reactions?: boolean;
	/** Reaction emoji to use */
	reactEmoji?: string;
	/** Maximum message length (default 2000) */
	maxMessageLength?: number;
	/** Typing indicator interval in ms (default 8000) */
	typingInterval?: number;
	/** Whether to download media attachments */
	downloadMedia?: boolean;
	/** Media download directory */
	mediaDir?: string;
	/** Whether to enable presence updates */
	presence?: boolean;
	/** Presence activity name */
	presenceActivity?: string;
	/** Presence status (online, idle, dnd, invisible) */
	presenceStatus?: "online" | "idle" | "dnd" | "invisible";
}

// ─── Message ─────────────────────────────────────────────────────────────────

export interface DiscordMessage {
	/** Message ID */
	messageId: string;
	/** Channel ID */
	channelId: string;
	/** Guild/Server ID */
	guildId?: string;
	/** Author user ID */
	fromId: string;
	/** Author username */
	fromUsername: string;
	/** Author discriminator (legacy) */
	fromDiscriminator?: string;
	/** Message content */
	text: string;
	/** Whether the message is edited */
	isEdited: boolean;
	/** Message creation timestamp (Unix ms) */
	createdAt: number;
	/** Message update timestamp (Unix ms) */
	updatedAt?: number;
	/** Attachments */
	attachments: Array<{
		id: string;
		filename: string;
		size: number;
		url: string;
		contentType: string;
	}>;
	/** Embeds */
	embeds: Array<{
		title?: string;
		description?: string;
		url?: string;
		color?: number;
		footer?: { text: string; iconUrl?: string };
		author?: { name: string; iconUrl?: string };
	}>;
	/** Mentioned users */
	mentionedUserIds: string[];
	/** Mentioned roles */
	mentionedRoleIds: string[];
	/** Channel type (0=DM, 1=group, 2=voice, 3=group voice, 4=server, 5=server voice) */
	channelType: number;
	/** Message type (0=regular, 7=reply, 19=thread starter message) */
	messageType: number;
	/** Whether the message contains components (buttons, selects) */
	hasComponents: boolean;
	/** Custom emoji used in the message */
	emoji: Array<{ id: string; name: string; animated: boolean }>;
	/** Reaction count */
	reactionCount: number;
	/** Thread ID if message is in a thread */
	threadId?: string;
	/** Whether the message is a system message */
	isSystem: boolean;
}

// ─── Send Options ────────────────────────────────────────────────────────────

export interface DiscordSendOptions {
	/** Whether to mention the author */
	mentionAuthor?: boolean;
	/** Whether to reply in thread */
	inThread?: boolean;
	/** Thread ID for reply */
	threadId?: string;
	/** Embed to send */
	embed?: DiscordEmbed;
	/** Allowed mentions */
	allowedMentions?: {
		parse?: Array<"roles" | "users" | "everyone">;
		roles?: string[];
		users?: string[];
		repliedUser?: boolean;
	};
	/** Components (buttons, selects) */
	components?: unknown[];
	/** File attachments */
	files?: Array<{ name: string; data: Buffer | string }>;
	/** TTS */
	tts?: boolean;
	/** Sticker ID */
	stickerIds?: string[];
}

export interface DiscordEmbed {
	title?: string;
	description?: string;
	url?: string;
	color?: number;
	footer?: { text: string; iconUrl?: string };
	image?: { url: string };
	thumbnail?: { url: string };
	author?: { name: string; iconUrl?: string };
	fields?: Array<{ name: string; value: string; inline?: boolean }>;
	timestamp?: Date;
}

// ─── Typing Indicator ────────────────────────────────────────────────────────

export interface DiscordTypingIndicator {
	/** Channel ID */
	channelId: string;
	/** Whether to force the typing indicator */
	force?: boolean;
}

// ─── Reaction ────────────────────────────────────────────────────────────────

export interface DiscordReaction {
	emoji: { id: string | null; name: string };
	count: number;
	me: boolean;
}

// ─── Channel Info ────────────────────────────────────────────────────────────

export interface DiscordChannelInfo {
	id: string;
	name: string;
	type: number;
	guildId?: string;
	topic?: string;
	memberCount?: number;
}

// ─── Guild Info ──────────────────────────────────────────────────────────────

export interface DiscordGuildInfo {
	id: string;
	name: string;
	icon?: string;
	ownerId: string;
	memberCount: number;
	description?: string;
	vanityUrl?: string;
	premiumTier: number;
}

// ─── User Info ───────────────────────────────────────────────────────────────

export interface DiscordUserInfo {
	id: string;
	username: string;
	discriminator: string;
	avatar?: string;
	bot?: boolean;
	system?: boolean;
	verified?: boolean;
	email?: string;
	flags?: number;
	premiumType?: number;
	publicFlags?: number;
}

// ─── Permission ──────────────────────────────────────────────────────────────

export interface DiscordPermission {
	createInstantInvite: boolean;
	kickMembers: boolean;
	banMembers: boolean;
	administrator: boolean;
	manageChannels: boolean;
	manageGuild: boolean;
	addReactions: boolean;
	viewAuditLog: boolean;
	voicePrioritySpeaker: boolean;
	stream: boolean;
	readMessages: boolean;
	sendMessages: boolean;
	sendTTSMessages: boolean;
	manageMessages: boolean;
	embedLinks: boolean;
	attachFiles: boolean;
	readMessageHistory: boolean;
	mentionEveryone: boolean;
	useExternalEmojis: boolean;
	viewGuildInsights: boolean;
	voiceConnect: boolean;
	voiceSpeak: boolean;
	voiceSilenceMembers: boolean;
	voiceDeafenMembers: boolean;
	voiceMoveMembers: boolean;
	voiceUseVAD: boolean;
	changeNickname: boolean;
	manageNicknames: boolean;
	manageRoles: boolean;
	manageWebhooks: boolean;
	manageEmojisAndStickers: boolean;
	useApplicationCommands: boolean;
	requestToSpeak: boolean;
	manageEvents: boolean;
	manageThreads: boolean;
	createPublicThreads: boolean;
	createPrivateThreads: boolean;
	useExternalStickers: boolean;
	sendMessagesInThreads: boolean;
	useEmbeddedActivities: boolean;
	moderateMembers: boolean;
	viewCreatorMonetizationAnalytics: boolean;
	useSoundboard: boolean;
	createGuildExpressions: boolean;
	createEvents: boolean;
	useExternalSounds: boolean;
	sendVoiceMessages: boolean;
	sendPolls: boolean;
	useExternalApps: boolean;
}

// ─── Streaming ───────────────────────────────────────────────────────────────

/** Stream buffer for Discord streaming output */
export type DiscordStreamBuffer = StreamBuffer<string>;

// ─── Outbound Message ────────────────────────────────────────────────────────

export interface DiscordOutboundMessage {
	/** Channel ID to send to */
	channelId: string;
	/** Message content */
	content: string;
	/** Media file paths */
	media?: string[];
	/** Metadata */
	metadata: {
		/** Original message ID to reply to */
		message_id?: string;
		/** Whether this is a progress update (not final) */
		_progress?: boolean;
		/** Whether to render as tool hint */
		_tool_hint?: boolean;
	};
}

// ─── Slash Command ───────────────────────────────────────────────────────────

export interface DiscordSlashCommand {
	/** Command name */
	name: string;
	/** Command description */
	description: string;
	/** Command options */
	options?: Array<{
		name: string;
		description: string;
		type: number;
		required?: boolean;
	}>;
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export interface DiscordStats {
	/** Whether connected */
	connected: boolean;
	/** Ready state */
	ready: boolean;
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
	/** Connected guild count */
	connectedGuilds: number;
	/** Connected channel count */
	connectedChannels: number;
}
