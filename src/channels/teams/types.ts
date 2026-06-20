/**
 * Microsoft Teams Channel — MS Teams Bot Framework integration for synthtek
 */

export interface TeamsConfig {
	/** Microsoft App ID */
	appId: string;
	/** Microsoft App Password/Secret */
	appPassword: string;
	/** Bot display name */
	botName?: string;
	/** Description */
	description?: string;
	/** Whether to enable E2E encryption for bot messages */
	encryptionEnabled?: boolean;
	/** Max retries */
	maxRetries?: number;
	/** Retry delay in ms */
	retryDelay?: number;
	/** Tenant ID (optional, for single-tenant) */
	tenantId?: string;
	/** Whether to send typing indicators */
	typingEnabled?: boolean;
	/** Webhook URL for receiving messages */
	webhookUrl?: string;
	/** Port for webhook server */
	webhookPort?: number;
}

export interface TeamsMessage {
	/** Activity ID */
	activityId: string;
	/** Conversation ID */
	conversationId: string;
	/** From user ID */
	fromId: string;
	/** From user name */
	fromName?: string;
	/** Channel/Team ID */
	channelId?: string;
	/** Channel/Team name */
	channelName?: string;
	/** Message text */
	text?: string;
	/** Message type */
	messageType:
		| "message"
		| "event"
		| "contactRelationUpdate"
		| "typing"
		| "endOfConversation";
	/** Timestamp */
	timestamp: number;
	/** Reply to activity ID */
	replyToId?: string;
	/** Locale */
	locale?: string;
	/** Channel data */
	channelData?: TeamsChannelData;
	/** Attachments */
	attachments?: TeamsAttachment[];
	/** Entities */
	entities?: TeamsEntity[];
	/** Local timestamp */
	localTimestamp?: number;
	/** Local timezone */
	localTimezone?: string;
}

export interface TeamsChannelData {
	/** Channel ID */
	channel?: { id: string };
	/** Team ID */
	team?: { id: string; name: string };
	/** Tenant ID */
	tenant?: { id: string };
	/** Source (teams, flowbot, etc.) */
	source?: string;
	/** Notification type */
	notificationType?: "adaptiveCard" | "silent";
}

export interface TeamsAttachment {
	/** Content type */
	contentType: string;
	/** Content */
	content: unknown;
	/** Name */
	name?: string;
	/** URL */
	url?: string;
	/** Thumbnail URL */
	thumbnailUrl?: string;
}

export interface TeamsEntity {
	/** Type */
	type: string;
	/** Mentions */
	mentions?: Array<{
		id: string;
		name: string;
		mentionedTimestamp: string;
	}>;
	/** Client info */
	clientInfo?: {
		platform: string;
		version: string;
		locale: string;
	};
}

export interface TeamsSendOptions {
	/** Conversation ID */
	conversationId: string;
	/** Message text */
	text: string;
	/** Locale */
	locale?: string;
	/** Reply to activity ID */
	replyToId?: string;
	/** Attachments */
	attachments?: TeamsSendAttachment[];
	/** Suggested actions */
	suggestedActions?: TeamsSuggestedAction;
	/** Summary (for notifications) */
	summary?: string;
}

export interface TeamsSendAttachment {
	/** Content type */
	contentType: string;
	/** Content */
	content: unknown;
	/** Name */
	name?: string;
	/** URL */
	url?: string;
}

export interface TeamsSuggestedAction {
	/** Title */
	title: string;
	/** Actions */
	actions: Array<{
		type: string;
		title: string;
		value: string;
	}>;
}

export interface TeamsConversationInfo {
	/** Conversation ID */
	conversationId: string;
	/** Conversation type */
	conversationType: "personal" | "channel" | "groupChat";
	/** Tenant ID */
	tenantId?: string;
	/** Topic */
	topic?: string;
	/** Created timestamp */
	createdTimestamp?: number;
	/** Member count */
	memberCount?: number;
}

export interface TeamsUserInfo {
	/** User ID */
	userId: string;
	/** Given name */
	givenName?: string;
	/** Family name */
	familyName?: string;
	/** Display name */
	displayName?: string;
	/** Email */
	email?: string;
	/** User principal name */
	userPrincipalName?: string;
	/** AAD object ID */
	aadObjectId?: string;
	/** Role */
	role?: "user" | "bot" | "anonymous";
}

export interface TeamsHealthStatus {
	/** Whether connected */
	connected: boolean;
	/** Authenticated */
	authenticated: boolean;
	/** Token expiry */
	tokenExpiry?: number;
	/** Active conversations count */
	conversationsCount: number;
	/** Messages sent count */
	messagesSent: number;
	/** Messages received count */
	messagesReceived: number;
	/** Last activity timestamp */
	lastActivity?: number;
}

export interface TeamsTypingIndicator {
	/** Conversation ID */
	conversationId: string;
	/** Whether typing */
	typing: boolean;
}
