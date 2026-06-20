/**
 * DingTalk Channel — DingTalk Stream integration for synthtek
 */

export interface DingTalkConfig {
	/** Client ID */
	clientId: string;
	/** Client Secret */
	clientSecret: string;
	/** Stream callback URL */
	streamUrl?: string;
	/** Max retries */
	maxRetries?: number;
	/** Retry delay in ms */
	retryDelay?: number;
	/** Token cache TTL in seconds */
	tokenTtl?: number;
}

export interface DingTalkMessage {
	/** Message ID */
	messageId: string;
	/** Conversation ID */
	conversationId: string;
	/** Conversation type */
	conversationType: "1" | "2" | "3"; // 1=chat, 2=group, 3=discussion
	/** Sender ID */
	senderId: string;
	/** Sender name */
	senderName?: string;
	/** Sender staff ID */
	senderStaffId?: string;
	/** Message type */
	messageType:
		| "text"
		| "richText"
		| "image"
		| "voice"
		| "video"
		| "file"
		| "link"
		| "markdown"
		| "actionCard";
	/** Content */
	content: string;
	/** Timestamp */
	timestamp: number;
	/** Create at */
	createAt: number;
	/** Reply to message ID */
	replyId?: string;
}

export interface DingTalkSendOptions {
	/** Open conversation ID */
	conversationId: string;
	/** Message type */
	msgKey: string;
	/** Message data (JSON string) */
	msgData: string;
	/** Robot code */
	robotCode?: string;
}

export interface DingTalkSendResult {
	/** Whether successful */
	success: boolean;
	/** Message ID */
	messageId?: string;
	/** Error code */
	errorCode?: number;
	/** Error message */
	errorMessage?: string;
}

export interface DingTalkHealthStatus {
	/** Whether connected */
	connected: boolean;
	/** Token valid */
	tokenValid: boolean;
	/** Token expiry */
	tokenExpiry?: number;
	/** Messages sent */
	messagesSent: number;
	/** Messages received */
	messagesReceived: number;
}
