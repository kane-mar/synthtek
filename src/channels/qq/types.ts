/**
 * QQ Channel — QQ Bot API integration for synthtek
 */

export interface QQConfig {
  /** Bot App ID */
  appId: string;
  /** Bot Token */
  token: string;
  /** Bot Secret */
  secret: string;
  /** Whether to enable group messages */
  groupMessages?: boolean;
  /** Whether to enable C2C messages */
  c2cMessages?: boolean;
  /** Max retries */
  maxRetries?: number;
  /** Retry delay in ms */
  retryDelay?: number;
  /** WebSocket URL override */
  wsUrl?: string;
}

export interface QQMessage {
  /** Message ID */
  messageId: string;
  /** Guild ID */
  guildId: string;
  /** Channel ID */
  channelId: string;
  /** Author user ID */
  authorId: string;
  /** Author nickname */
  authorName?: string;
  /** Message content */
  content: string;
  /** Message type */
  messageType: 'C2C' | 'GROUP';
  /** Timestamp */
  timestamp: number;
  /** Mentions */
  mentions?: Array<{
    id: string;
    username: string;
  }>;
  /** Attachments */
  attachments?: Array<{
    url: string;
    content_type: string;
    width?: number;
    height?: number;
    size?: number;
  }>;
  /** Embeds */
  embeds?: Array<{
    title?: string;
    description?: string;
    image?: { url: string };
  }>;
  /** Reply to message */
  reference?: {
    message_id: string;
    ignore: boolean;
  };
}

export interface QQSendOptions {
  /** Channel ID */
  channelId: string;
  /** Message content */
  content: string;
  /** Message type */
  msgType?: 'C2C' | 'GROUP';
  /** Media type */
  mediaType?: 'image' | 'file' | 'voice' | 'video';
  /** File SID (for media) */
  fileSid?: string;
  /** Reply to message ID */
  messageId?: string;
  /** Embed */
  embed?: Record<string, unknown>;
  /** ARK template */
  ark?: Record<string, unknown>;
}

export interface QQHealthStatus {
  /** Whether connected */
  connected: boolean;
  /** WebSocket status */
  wsStatus: 'connected' | 'disconnected' | 'connecting';
  /** Messages sent */
  messagesSent: number;
  /** Messages received */
  messagesReceived: number;
  /** Last activity */
  lastActivity?: number;
}
