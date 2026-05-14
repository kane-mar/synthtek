/**
 * Feishu/Lark Channel — Lark API integration for synthtek
 */

export interface FeishuConfig {
  /** App ID */
  appId: string;
  /** App Secret */
  appSecret: string;
  /** Verification token */
  verifyToken?: string;
  /** Encrypt key */
  encryptKey?: string;
  /** Whether to use global domain (open.larksuite.com) */
  useGlobalDomain?: boolean;
  /** Max retries */
  maxRetries?: number;
  /** Retry delay in ms */
  retryDelay?: number;
  /** Webhook port */
  webhookPort?: number;
  /** Whether to enable CardKit streaming */
  cardKitEnabled?: boolean;
}

export interface FeishuMessage {
  /** Message ID */
  messageId: string;
  /** Chat ID */
  chatId: string;
  /** Chat type */
  chatType: 'p2p' | 'group';
  /** Sender ID */
  senderId: string;
  /** Sender name */
  senderName?: string;
  /** Message content */
  content: string;
  /** Message type */
  messageType: 'text' | 'post' | 'image' | 'file' | 'media' | 'share_chat' | 'interactive';
  /** Timestamp */
  timestamp: number;
  /** Create time */
  createTime: number;
  /** Mentions */
  mentions?: Array<{
    key: string;
    id: {
      id: string;
      type: string;
    };
    name: string;
  }>;
  /** Reply to message ID */
  parentId?: string;
  /** Root message ID */
  rootId?: string;
}

export interface FeishuSendOptions {
  /** Receive ID (user, chat, or open_id) */
  receiveId: string;
  /** Receive ID type */
  receiveIdType?: 'open_id' | 'user_id' | 'chat_id';
  /** Message type */
  msgType: 'text' | 'post' | 'image' | 'file' | 'interactive';
  /** Message content */
  content: string;
  /** UUID for deduplication */
  uuid?: string;
  /** Reply to message ID */
  replyMessageId?: string;
}

export interface FeishuCardOptions {
  /** Receive ID */
  receiveId: string;
  /** Receive ID type */
  receiveIdType?: 'open_id' | 'user_id' | 'chat_id';
  /** Card JSON content */
  card: Record<string, unknown>;
  /** Message ID to update (for CardKit streaming) */
  messageId?: string;
}

export interface FeishuCardResult {
  /** Whether successful */
  success: boolean;
  /** Message ID */
  messageId?: string;
  /** Error */
  error?: string;
}

export interface FeishuUserInfo {
  /** User ID */
  userId: string;
  /** Open ID */
  openId: string;
  /** Name */
  name: string;
  /** Email */
  email?: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** Title */
  title?: string;
}

export interface FeishuChatInfo {
  /** Chat ID */
  chatId: string;
  /** Chat name */
  name?: string;
  /** Chat type */
  chatType: 'p2p' | 'group';
  /** Owner ID */
  ownerId?: string;
  /** Create time */
  createTime?: number;
  /** Member count */
  memberCount?: number;
}

export interface FeishuHealthStatus {
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
  /** Last activity */
  lastActivity?: number;
}
