/**
 * Unified channel configuration types for AgentRunner
 *
 * Allows configuring any channel from a single config object.
 * Each channel type gets its own optional config keyed by channel name.
 */

import type { DingTalkConfig } from "../channels/dingtalk/types.js";
import type { DiscordConfig } from "../channels/discord/types.js";
import type { EmailConfig } from "../channels/email/types.js";
import type { FeishuConfig } from "../channels/feishu/types.js";
import type { MatrixConfig } from "../channels/matrix/types.js";
import type { QQConfig } from "../channels/qq/types.js";
import type { SlackConfig } from "../channels/slack/types.js";
import type { TeamsConfig } from "../channels/teams/types.js";
import type { TelegramConfig } from "../channels/telegram/types.js";
import type { WebSocketChannelConfig } from "../channels/websocket/types.js";
import type { WeChatConfig } from "../channels/wechat/types.js";
import type { WeComConfig } from "../channels/wecom/types.js";
import type { WhatsAppConfig } from "../channels/whatsapp/types.js";

/**
 * Map of channel type → channel config.
 * Include only the channels you want to enable.
 *
 * @example
 * {
 *   telegram: { token: "123:ABC", usePolling: true },
 *   discord: { token: "bot-token" },
 *   slack: { token: "xoxb-..." },
 * }
 */
export interface ChannelConfigs {
	telegram?: TelegramConfig;
	discord?: DiscordConfig;
	slack?: SlackConfig;
	wechat?: WeChatConfig;
	wecom?: WeComConfig;
	feishu?: FeishuConfig;
	matrix?: MatrixConfig;
	qq?: QQConfig;
	dingtalk?: DingTalkConfig;
	email?: EmailConfig;
	teams?: TeamsConfig;
	whatsapp?: WhatsAppConfig;
	websocket?: WebSocketChannelConfig;
}

/** All supported channel type names */
export type ChannelType = keyof ChannelConfigs;
