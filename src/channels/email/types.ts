/**
 * Email Channel — IMAP/SMTP integration for synthtek
 */

export interface EmailConfig {
	/** SMTP server host */
	smtpHost: string;
	/** SMTP server port */
	smtpPort?: number;
	/** SMTP username */
	smtpUser: string;
	/** SMTP password */
	smtpPass: string;
	/** Whether to use TLS */
	smtpTls?: boolean;
	/** IMAP server host */
	imapHost: string;
	/** IMAP server port */
	imapPort?: number;
	/** IMAP username */
	imapUser: string;
	/** IMAP password */
	imapPass: string;
	/** Whether to use TLS for IMAP */
	imapTls?: boolean;
	/** Email address to send from */
	fromAddress: string;
	/** Polling interval in ms */
	pollingInterval?: number;
	/** Max emails per poll */
	maxEmailsPerPoll?: number;
	/** Whether to mark emails as read */
	markAsRead?: boolean;
	/** Folder to check */
	folder?: string;
	/** Sender whitelist (only process emails from these addresses) */
	senderWhitelist?: string[];
	/** Attachment max size in bytes */
	maxAttachmentSize?: number;
}

export interface EmailMessage {
	/** Unique email ID */
	emailId: string;
	/** Message ID header */
	messageId: string;
	/** In-Reply-To header */
	inReplyTo?: string;
	/** References header */
	references?: string;
	/** From address */
	from: string;
	/** From name */
	fromName?: string;
	/** To addresses */
	to: string[];
	/** CC addresses */
	cc?: string[];
	/** BCC addresses */
	bcc?: string[];
	/** Subject */
	subject: string;
	/** Plain text body */
	textBody?: string;
	/** HTML body */
	htmlBody?: string;
	/** Date received */
	date: Date;
	/** Internal date */
	internalDate: Date;
	/** Flags */
	flags: string[];
	/** Attachments */
	attachments: EmailAttachment[];
	/** Whether email is read */
	isRead: boolean;
	/** Priority */
	priority?: "high" | "normal" | "low";
}

export interface EmailAttachment {
	/** Filename */
	filename: string;
	/** MIME type */
	contentType: string;
	/** Content in base64 */
	content: string;
	/** Size in bytes */
	size: number;
	/** Content disposition */
	disposition?: "attachment" | "inline";
}

export interface EmailSendOptions {
	/** To addresses */
	to: string | string[];
	/** CC addresses */
	cc?: string | string[];
	/** BCC addresses */
	bcc?: string | string[];
	/** Subject */
	subject: string;
	/** Plain text body */
	text?: string;
	/** HTML body */
	html?: string;
	/** Reply-to address */
	replyTo?: string;
	/** Attachments */
	attachments?: EmailSendAttachment[];
	/** Priority */
	priority?: "high" | "normal" | "low";
}

export interface EmailSendAttachment {
	/** Filename */
	filename: string;
	/** Content as buffer or base64 string */
	content: Buffer | string;
	/** MIME type */
	contentType: string;
}

export interface EmailSendResult {
	/** Whether send was successful */
	success: boolean;
	/** Message ID */
	messageId?: string;
	/** Error message */
	error?: string;
}

export interface EmailHealthStatus {
	/** Whether SMTP is connected */
	smtpConnected: boolean;
	/** Whether IMAP is connected */
	imapConnected: boolean;
	/** Last poll timestamp */
	lastPoll?: number;
	/** Total emails processed */
	emailsProcessed: number;
	/** Total emails sent */
	emailsSent: number;
	/** Pending emails count */
	pendingEmails: number;
}

export interface ScheduledReport {
	/** Report name */
	name: string;
	/** Cron expression */
	schedule: string;
	/** Recipient email */
	recipient: string;
	/** Report template */
	template: string;
	/** Whether enabled */
	enabled: boolean;
	/** Last sent timestamp */
	lastSent?: number;
}
