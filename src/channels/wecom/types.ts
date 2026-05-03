/**
 * WeCom Channel — WeCom SDK integration for synthtek
 */

export interface WeComConfig {
  /** Corp ID */
  corpId: string;
  /** Agent ID */
  agentId: number;
  /** Agent Secret */
  agentSecret: string;
  /** API base URL */
  apiBaseUrl?: string;
  /** Max retries */
  maxRetries?: number;
  /** Retry delay in ms */
  retryDelay?: number;
  /** Token cache TTL in seconds */
  tokenTtl?: number;
}

export interface WeComMessage {
  /** Message ID */
  messageId: string;
  /** From user */
  fromUser: string;
  /** To user (bot) */
  toUser: string;
  /** To all */
  toAll: boolean;
  /** Message type */
  messageType: 'text' | 'image' | 'voice' | 'video' | 'file' | 'location' | 'link' | 'markdown';
  /** Content */
  content: string;
  /** Media ID */
  mediaId?: string;
  /** Timestamp */
  timestamp: number;
  /** Create time */
  createTime: number;
  /** Status */
  status?: number;
}

export interface WeComSendOptions {
  /** User IDs (comma-separated or array) */
  userIds: string | string[];
  /** Party IDs */
  partyIds?: number[];
  /** Tag IDs */
  tagIds?: number[];
  /** Message type */
  msgType: 'text' | 'image' | 'voice' | 'video' | 'file' | 'textcard' | 'news' | 'mpnews' | 'markdown';
  /** Content or media ID */
  content?: string;
  /** Media ID */
  mediaId?: string;
  /** Title (for cards/news) */
  title?: string;
  /** Description */
  description?: string;
  /** URL */
  url?: string;
  /** Whether to enable duplicate check */
  enableDuplicateCheck?: boolean;
}

export interface WeComSendResult {
  /** Whether successful */
  success: boolean;
  /** Error code */
  errorCode?: number;
  /** Error message */
  errorMessage?: string;
  /** Invalid user list */
  invalidUsers?: string;
  /** Invalid party list */
  invalidParties?: string;
}

export interface WeComHealthStatus {
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
