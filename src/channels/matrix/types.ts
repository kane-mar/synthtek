/**
 * Matrix Channel — matrix-nio integration for synthtek
 */

export interface MatrixConfig {
	/** Homeserver URL (e.g., https://matrix.org) */
	homeserver: string;
	/** Access token */
	accessToken: string;
	/** Device ID (optional) */
	deviceId?: string;
	/** User ID */
	userId: string;
	/** Whether to enable E2E encryption */
	e2eEnabled?: boolean;
	/** Key backup version (for E2E) */
	keyBackupVersion?: string;
	/** Presence status */
	presence?: "online" | "offline" | "unavailable";
	/** Max retries for API calls */
	maxRetries?: number;
	/** Retry delay in ms */
	retryDelay?: number;
}

export interface MatrixMessage {
	/** Event ID */
	eventId: string;
	/** Room ID */
	roomId: string;
	/** Sender user ID */
	senderId: string;
	/** Message body (plain text) */
	body: string;
	/** Message type */
	msgType:
		| "m.text"
		| "m.emote"
		| "m.image"
		| "m.file"
		| "m.video"
		| "m.audio"
		| "m.location";
	/** Formatted body (HTML) */
	formattedBody?: string;
	/** Timestamp */
	timestamp: number;
	/** Reply to event ID */
	inReplyTo?: string;
	/** Relation (thread, reply, etc.) */
	relation?: {
		rel_type: "reply" | "m.thread";
		event_id?: string;
		in_reply_to_event?: string;
	};
	/** File info for media messages */
	fileInfo?: {
		url: string;
		mimetype: string;
		size: number;
		width?: number;
		height?: number;
	};
	/** Caption for media */
	bodyCaption?: string;
}

export interface MatrixSendOptions {
	/** Room ID to send to */
	roomId: string;
	/** Message body */
	body: string;
	/** Message type */
	msgType?: "m.text" | "m.emote";
	/** HTML formatted body */
	formattedBody?: string;
	/** Reply to event ID */
	inReplyTo?: string;
	/** Thread root event ID */
	threadRoot?: string;
}

export interface MatrixRoomInfo {
	/** Room ID */
	roomId: string;
	/** Room name */
	name?: string;
	/** Room topic */
	topic?: string;
	/** Room avatar URL */
	avatarUrl?: string;
	/** World readable */
	worldReadable?: boolean;
	/** Guest can join */
	guestCanJoin?: boolean;
	/** Join rule */
	joinRule?: "public" | "invite" | "knock" | "private";
	/** Member count */
	memberCount?: number;
	/** Canonical alias */
	canonicalAlias?: string;
}

export interface MatrixUserInfo {
	/** User ID */
	userId: string;
	/** Display name */
	displayName?: string;
	/** Avatar URL */
	avatarUrl?: string;
	/** Presence */
	presence?: "online" | "offline" | "unavailable";
	/** Status message */
	statusMsg?: string;
}

export interface MatrixReaction {
	/** Event ID */
	eventId: string;
	/** Room ID */
	roomId: string;
	/** Sender */
	senderId: string;
	/** Key (emoji) */
	key: string;
	/** Related event ID */
	relatedEventId: string;
	/** Timestamp */
	timestamp: number;
}

export interface MatrixTypingIndicator {
	/** Room ID */
	roomId: string;
	/** User ID */
	userId: string;
	/** Whether user is typing */
	typing: boolean;
}

export interface MatrixHealthStatus {
	/** Whether connected */
	connected: boolean;
	/** Sync token */
	syncToken?: string;
	/** Connected rooms count */
	roomsCount: number;
	/** E2E encryption status */
	e2eEnabled: boolean;
	/** Last sync timestamp */
	lastSync?: number;
}

export interface MatrixEvent {
	/** Event ID */
	eventId: string;
	/** Event type */
	type: string;
	/** Room ID */
	roomId: string;
	/** Sender */
	sender: string;
	/** Content */
	content: Record<string, unknown>;
	/** Timestamp */
	ts: number;
	/** State key (for state events) */
	stateKey?: string;
}
