/**
 * WeChat Channel Types
 */

export interface WeChatConfig {
	appId: string;
	appSecret: string;
	token: string;
	encodingAESKey: string;
	port?: number;
	webhookUrl?: string;
}

export interface WeChatRawMessage {
	ToUserName: string;
	FromUserName: string;
	MsgType: string;
	Content?: string;
	MediaId?: string;
	ThumbMediaId?: string;
	Format?: string;
	CreateTime: number;
	MsgId: string;
	IsGroup?: boolean;
}

export interface WeChatMessage {
	role: "user" | "assistant" | "system";
	content: string;
	userId: string;
	msgId: string;
	timestamp: number;
	mediaType?: "image" | "audio" | "video" | "file";
	mediaId?: string;
	mediaFormat?: string;
	isGroup?: boolean;
}

export interface WeChatSendOptions {
	mediaType?: "image" | "audio" | "video" | "textcard";
	mediaId?: string;
	thumbMediaId?: string;
	title?: string;
	description?: string;
	url?: string;
}

export interface WeChatPayload {
	touser: string;
	msgtype: string;
	text?: { content: string };
	image?: { media_id: string };
	voice?: { media_id: string };
	video?: { media_id: string; thumb_media_id: string };
	textcard?: { title: string; description: string; url?: string };
}

export interface WeChatHealthStatus {
	name: string;
	status: string;
	connected: boolean;
	uptime: number;
}

export interface WeChatStats {
	messagesReceived: number;
	messagesSent: number;
	errors: number;
}
