/**
 * WhatsApp Channel — WhatsApp Business API integration for synthtek
 */

export interface WhatsAppConfig {
  /** WhatsApp Business API phone number ID */
  phoneNumberId: string;
  /** WhatsApp Business API business ID */
  businessId: string;
  /** WhatsApp API access token */
  accessToken: string;
  /** WhatsApp API base URL */
  apiBaseUrl?: string;
  /** API version */
  apiVersion?: string;
  /** Webhook verify token */
  webhookVerifyToken?: string;
  /** Webhook app secret */
  webhookAppSecret?: string;
  /** Whether to enable webhook */
  webhookEnabled?: boolean;
  /** Webhook port */
  webhookPort?: number;
  /** Max retries */
  maxRetries?: number;
  /** Retry delay in ms */
  retryDelay?: number;
  /** Whether to send read receipts */
  readReceipts?: boolean;
  /** Whether to send typing indicators */
  typingEnabled?: boolean;
}

export interface WhatsAppMessage {
  /** WhatsApp message ID */
  messageId: string;
  /** From phone number */
  from: string;
  /** From name */
  fromName?: string;
  /** To phone number (business) */
  to: string;
  /** Timestamp */
  timestamp: number;
  /** Message type */
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'contacts' | 'reaction' | 'interactive';
  /** Text content */
  text?: { body: string };
  /** Media info */
  media?: {
    id: string;
    mimetype: string;
    filename?: string;
    caption?: string;
    sha256?: string;
    filesize?: number;
  };
  /** Reaction info */
  reaction?: {
    message_id: string;
    emoji: string;
  };
  /** Interactive message */
  interactive?: {
    type: 'button_reply' | 'list_reply' | 'nfm_reply';
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description: string };
  };
  /** Context (reply to) */
  context?: {
    message_id: string;
    from: string;
    forwarded?: boolean;
  };
  /** Metadata */
  metadata?: {
    display_phone_number: string;
    phone_number_id: string;
  };
  /** Whether delivered */
  delivered?: boolean;
  /** Whether read */
  read?: boolean;
}

export interface WhatsAppSendOptions {
  /** Recipient phone number (with country code) */
  to: string;
  /** Message type */
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'template';
  /** Text content */
  text?: string;
  /** Media ID (for media messages) */
  mediaId?: string;
  /** Media caption */
  caption?: string;
  /** Template name (for template messages) */
  templateName?: string;
  /** Template components */
  templateComponents?: unknown[];
  /** Reply to message ID */
  replyTo?: string;
  /** Whether to enable preview URL */
  previewUrl?: boolean;
}

export interface WhatsAppSendResult {
  /** Whether send was successful */
  success: boolean;
  /** WhatsApp message ID */
  messageId?: string;
  /** Error message */
  error?: string;
  /** Pricing info */
  pricing?: {
    billable: boolean;
    pricing_type: 'CBP' | 'CP15' | 'CP20' | 'CP25' | 'CP40' | 'CP80';
    category: 'authentication' | 'marketing' | 'utility' | 'utility_form_based' | 'service';
  };
}

export interface WhatsAppHealthStatus {
  /** Whether connected */
  connected: boolean;
  /** Phone number status */
  phoneNumberStatus: 'connected' | 'disconnected' | 'unknown';
  /** Messages sent count */
  messagesSent: number;
  /** Messages received count */
  messagesReceived: number;
  /** Last activity timestamp */
  lastActivity?: number;
  /** Webhook status */
  webhookActive: boolean;
}

export interface WhatsAppContact {
  /** Waid */
  waid: string;
  /** Profile name */
  profile: { name: string };
}
