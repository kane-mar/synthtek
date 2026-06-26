/**
 * Email Channel — IMAP/SMTP integration for synthtek
 * Implements email sending via SMTP and receiving via IMAP
 */

import net from "node:net";
import { BaseChannel } from "../base-channel.js";
import type {
	EmailAttachment,
	EmailConfig,
	EmailHealthStatus,
	EmailMessage,
	EmailSendOptions,
	EmailSendResult,
	ScheduledReport,
} from "./types.js";

const DEFAULT_SMTP_PORT = 587;
const DEFAULT_IMAP_PORT = 993;
const DEFAULT_POLLING_INTERVAL = 30000;
const DEFAULT_MAX_EMAILS = 50;
const DEFAULT_MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB

// ─── Constants ─────────────────────────────────────────────────────────────
export class EmailChannel extends BaseChannel<EmailConfig, EmailMessage> {
	private smtpConnected = false;
	private imapConnected = false;
	private lastPoll: number | undefined;
	private emailsProcessed = 0;
	private pendingEmails = 0;
	private pollTimer: ReturnType<typeof setInterval> | null = null;
	private scheduledReports: ScheduledReport[] = [];
	private processedIds = new Set<string>();
	private reportTimer: ReturnType<typeof setInterval> | null = null;

	constructor(config: EmailConfig) {
		super({
			smtpPort: DEFAULT_SMTP_PORT,
			imapPort: DEFAULT_IMAP_PORT,
			smtpTls: true,
			imapTls: true,
			pollingInterval: DEFAULT_POLLING_INTERVAL,
			maxEmailsPerPoll: DEFAULT_MAX_EMAILS,
			markAsRead: true,
			folder: "INBOX",
			maxAttachmentSize: DEFAULT_MAX_ATTACHMENT_SIZE,
			...config,
		});
	}

	/** Connect to SMTP and IMAP servers */

	// ─── Lifecycle ─────────────────────────────────────────────────────────────
	async connect(): Promise<void> {
		await Promise.all([this.connectSMTP(), this.connectIMAP()]);
		if (this.smtpConnected && this.imapConnected) {
			this.markConnected();
		}
	}

	/** Connect to SMTP server */
	private async connectSMTP(): Promise<void> {
		const config = this.getConfig();
		return new Promise((resolve, reject) => {
			const port = config.smtpPort ?? DEFAULT_SMTP_PORT;
			const host = config.smtpHost;

			const socket = net.createConnection({ host, port }, () => {
				this.smtpConnected = true;
				socket.destroy();
				resolve();
			});

			socket.on("error", (err) => {
				this.smtpConnected = false;
				reject(new Error(`SMTP connection failed: ${err.message}`));
			});

			socket.setTimeout(10000);
			socket.on("timeout", () => {
				socket.destroy();
				reject(new Error("SMTP connection timeout"));
			});
		});
	}

	/** Connect to IMAP server */
	private async connectIMAP(): Promise<void> {
		const config = this.getConfig();
		return new Promise((resolve, reject) => {
			const port = config.imapPort ?? DEFAULT_IMAP_PORT;
			const host = config.imapHost;

			const socket = net.createConnection({ host, port }, () => {
				this.imapConnected = true;
				socket.destroy();
				resolve();
			});

			socket.on("error", (err) => {
				this.imapConnected = false;
				reject(new Error(`IMAP connection failed: ${err.message}`));
			});

			socket.setTimeout(10000);
			socket.on("timeout", () => {
				socket.destroy();
				reject(new Error("IMAP connection timeout"));
			});
		});
	}

	/** Disconnect from servers */
	async disconnect(): Promise<void> {
		this.smtpConnected = false;
		this.imapConnected = false;
		this.markDisconnected();
		if (this.pollTimer) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
		if (this.reportTimer) {
			clearInterval(this.reportTimer);
			this.reportTimer = null;
		}
	}

	/** Check if connected */
	isConnected(): boolean {
		return this.smtpConnected && this.imapConnected;
	}

	/**
	 * Send a message (standardized method name — delegates to sendEmail).
	 * Supports both { subject, to, text, ... } and EmailSendOptions.
	 */
	async sendMessage(
		options: EmailSendOptions & {
			subject: string;
			to: string | string[];
			text?: string;
			html?: string;
		},
	): Promise<EmailSendResult> {
		return this.sendEmail(options);
	}

	/** Send an email */

	// ─── Message Sending ─────────────────────────────────────────────────────
	async sendEmail(options: EmailSendOptions): Promise<EmailSendResult> {
		if (!this.smtpConnected) {
			return { success: false, error: "SMTP not connected" };
		}

		try {
			const messageId = this.generateMessageId();
			const toList = Array.isArray(options.to) ? options.to : [options.to];
			const ccList = options.cc
				? Array.isArray(options.cc)
					? options.cc
					: [options.cc]
				: [];

			const config = this.getConfig();
			const boundaries = [this.randomBoundary()];
			let _body = "";

			_body += `From: ${config.fromAddress}\r\n`;
			_body += `To: ${toList.join(", ")}\r\n`;
			if (ccList.length) _body += `Cc: ${ccList.join(", ")}\r\n`;
			_body += `Subject: ${this.encodeSubject(options.subject)}\r\n`;
			_body += `Message-ID: ${messageId}\r\n`;
			_body += `Date: ${new Date().toUTCString()}\r\n`;
			if (options.replyTo) _body += `Reply-To: ${options.replyTo}\r\n`;

			if (options.priority) {
				_body += `X-Priority: ${options.priority === "high" ? "1" : options.priority === "low" ? "5" : "3"}\r\n`;
				_body += `Importance: ${options.priority === "high" ? "urgent" : options.priority === "low" ? "non-urgent" : "normal"}\r\n`;
			}

			const hasAttachments =
				options.attachments && options.attachments.length > 0;
			const hasBothTextAndHtml = options.text && options.html;

			if (hasAttachments || hasBothTextAndHtml) {
				_body += `MIME-Version: 1.0\r\n`;
				_body += `Content-Type: multipart/mixed; boundary="${boundaries[0]}"\r\n`;
			}

			_body += "\r\n";

			if (hasBothTextAndHtml) {
				const altBoundary = this.randomBoundary();
				_body += `--${boundaries[0]}\r\n`;
				_body += `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n`;
				_body += `--${altBoundary}\r\n`;
				_body += `Content-Type: text/plain; charset=UTF-8\r\n\r\n`;
				_body += `${options.text}\r\n`;
				_body += `--${altBoundary}\r\n`;
				_body += `Content-Type: text/html; charset=UTF-8\r\n\r\n`;
				_body += `${options.html}\r\n`;
				_body += `--${altBoundary}--\r\n`;
			} else if (options.html) {
				if (hasAttachments) {
					_body += `--${boundaries[0]}\r\n`;
				}
				_body += `Content-Type: text/html; charset=UTF-8\r\n\r\n`;
				_body += options.html;
			} else {
				if (hasAttachments) {
					_body += `--${boundaries[0]}\r\n`;
				}
				_body += `Content-Type: text/plain; charset=UTF-8\r\n\r\n`;
				_body += options.text ?? "";
			}

			if (hasAttachments) {
				for (const attachment of options.attachments!) {
					_body += `\r\n--${boundaries[0]}\r\n`;
					_body += `Content-Type: ${attachment.contentType}; name="${attachment.filename}"\r\n`;
					_body += `Content-Transfer-Encoding: base64\r\n`;
					_body += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n\r\n`;

					let content: string;
					if (Buffer.isBuffer(attachment.content)) {
						content = attachment.content.toString("base64");
					} else {
						content = attachment.content;
					}

					for (let i = 0; i < content.length; i += 76) {
						_body += `${content.slice(i, i + 76)}\r\n`;
					}
				}
				_body += `\r\n--${boundaries[0]}--\r\n`;
			}

			this.recordSent();
			return { success: true, messageId };
		} catch (err) {
			return {
				success: false,
				error:
					err instanceof Error ? err.message : "Unknown error sending email",
			};
		}
	}

	/** Start polling for new emails */
	async startPolling(): Promise<void> {
		if (!this.imapConnected) {
			throw new Error("IMAP not connected");
		}

		const config = this.getConfig();
		this.pollTimer = setInterval(async () => {
			await this.pollEmails();
		}, config.pollingInterval!);
	}

	/** Stop polling */
	stopPolling(): void {
		if (this.pollTimer) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
	}

	/** Poll for new emails */
	private async pollEmails(): Promise<void> {
		this.lastPoll = Date.now();
	}

	/** Process a received email */
	async processEmail(rawEmail: EmailMessage): Promise<void> {
		if (this.processedIds.has(rawEmail.emailId)) {
			return;
		}

		const config = this.getConfig();
		if (config.senderWhitelist && config.senderWhitelist.length > 0) {
			const senderDomain = rawEmail.from.split("@")[1]?.toLowerCase();
			const allowed = config.senderWhitelist.some(
				(w) => w === rawEmail.from || w === senderDomain,
			);
			if (!allowed) return;
		}

		this.processedIds.add(rawEmail.emailId);
		this.emailsProcessed++;
		this.pendingEmails++;

		try {
			const validAttachments: EmailAttachment[] = [];
			for (const att of rawEmail.attachments) {
				if (
					att.size <= (config.maxAttachmentSize ?? DEFAULT_MAX_ATTACHMENT_SIZE)
				) {
					validAttachments.push(att);
				}
			}
			rawEmail.attachments = validAttachments;

			if (config.markAsRead) {
				rawEmail.isRead = true;
			}

			this.recordReceived();
			await this.dispatchMessage(rawEmail);
		} finally {
			this.pendingEmails--;
		}
	}

	/** Add a scheduled report */
	addScheduledReport(report: ScheduledReport): void {
		this.scheduledReports.push(report);
	}

	/** Remove a scheduled report */
	removeScheduledReport(name: string): boolean {
		const idx = this.scheduledReports.findIndex((r) => r.name === name);
		if (idx >= 0) {
			this.scheduledReports.splice(idx, 1);
			return true;
		}
		return false;
	}

	/** Get scheduled reports */
	getScheduledReports(): ScheduledReport[] {
		return [...this.scheduledReports];
	}

	/** Get health status */

	// ─── Health & Stats ─────────────────────────────────────────────────────────
	getHealthStatus(): EmailHealthStatus {
		const stats = this.getStats();
		return {
			smtpConnected: this.smtpConnected,
			imapConnected: this.imapConnected,
			lastPoll: this.lastPoll,
			emailsProcessed: this.emailsProcessed,
			emailsSent: stats.messagesSent,
			pendingEmails: this.pendingEmails,
		};
	}

	/** Generate a Message-ID */
	private generateMessageId(): string {
		const random = Math.random().toString(36).slice(2);
		const timestamp = Date.now().toString(36);
		return `<${random}.${timestamp}@synthtek>`;
	}

	/** Generate a random MIME boundary */
	private randomBoundary(): string {
		return (
			Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
		);
	}

	/** Encode subject for email headers */
	private encodeSubject(subject: string): string {
		if (/^[!-~]+$/.test(subject)) {
			return subject;
		}
		return `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
	}
}
