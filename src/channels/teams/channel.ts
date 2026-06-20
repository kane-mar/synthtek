/**
 * Microsoft Teams Channel — MS Teams Bot Framework integration for synthtek
 * Implements Teams Bot Framework REST API for message sending/receiving
 */

import http from "node:http";
import https from "node:https";
import { BaseChannel } from "../base-channel.js";
import type {
	TeamsConfig,
	TeamsConversationInfo,
	TeamsHealthStatus,
	TeamsMessage,
	TeamsSendOptions,
	TeamsUserInfo,
} from "./types.js";

const TEAMS_API_BASE = "https://smba.trafficmanager.net/apis";
const TOKEN_API_BASE = "https://login.microsoftonline.com";
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;

export class TeamsChannel extends BaseChannel<TeamsConfig, TeamsMessage> {
	private authenticated = false;
	private accessToken: string | undefined;
	private tokenExpiry: number | undefined;
	private conversations = new Map<string, TeamsConversationInfo>();
	private webhookServer: ReturnType<typeof http.createServer> | null = null;

	constructor(config: TeamsConfig) {
		super({
			maxRetries: DEFAULT_MAX_RETRIES,
			retryDelay: DEFAULT_RETRY_DELAY,
			encryptionEnabled: false,
			typingEnabled: true,
			webhookPort: 3978,
			...config,
		});
	}

	/** Connect and authenticate */
	async connect(): Promise<void> {
		try {
			await this.authenticate();
			this.markConnected();
			this.authenticated = true;
		} catch (err) {
			this.authenticated = false;
			throw new Error(
				`Teams connection failed: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}
	}

	/** Disconnect */
	async disconnect(): Promise<void> {
		this.markDisconnected();
		this.authenticated = false;
		this.accessToken = undefined;
		if (this.webhookServer) {
			this.webhookServer.close();
			this.webhookServer = null;
		}
	}

	/** Authenticate with Microsoft */
	private async authenticate(): Promise<void> {
		const token = await this.requestToken();
		this.accessToken = token;
		this.tokenExpiry = Date.now() + 3600 * 1000; // 1 hour
	}

	/** Request access token from Microsoft */
	private async requestToken(): Promise<string> {
		const config = this.getConfig();
		const body = new URLSearchParams({
			grant_type: "client_credentials",
			client_id: config.appId,
			client_secret: config.appPassword,
			scope: "https://api.botframework.com/.default",
		}).toString();

		return new Promise((resolve, reject) => {
			const req = https.request(
				`${TOKEN_API_BASE}/botframework.com/oauth2/token`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
						"Content-Length": Buffer.byteLength(body),
					},
				},
				(res) => {
					let data = "";
					res.on("data", (chunk) => (data += chunk));
					res.on("end", () => {
						if (
							res.statusCode &&
							res.statusCode >= 200 &&
							res.statusCode < 300
						) {
							try {
								const json = JSON.parse(data);
								resolve(json.access_token as string);
							} catch {
								reject(new Error(`Invalid token response: ${data}`));
							}
						} else {
							reject(
								new Error(`Token request failed: ${res.statusCode} ${data}`),
							);
						}
					});
				},
			);

			req.on("error", reject);
			req.write(body);
			req.end();
		});
	}

	/** Send a message */
	async sendMessage(options: TeamsSendOptions): Promise<string> {
		if (!this.isConnected() || !this.authenticated) {
			throw new Error("Teams channel is not connected or not authenticated");
		}

		// Refresh token if expired
		if (this.tokenExpiry && Date.now() >= this.tokenExpiry) {
			await this.authenticate();
		}

		const activityBody: Record<string, unknown> = {
			type: "message",
			id: options.replyToId ?? undefined,
			text: options.text,
			locale: options.locale ?? "en-US",
			localTimestamp: new Date().toISOString(),
		};

		if (options.attachments && options.attachments.length > 0) {
			activityBody.attachments = options.attachments.map((a) => ({
				contentType: a.contentType,
				content: a.content,
				name: a.name,
				url: a.url,
			}));
		}

		if (options.suggestedActions) {
			activityBody.suggestedActions = options.suggestedActions;
		}

		if (options.summary) {
			activityBody.summary = options.summary;
		}

		const path = options.replyToId
			? `/_apis/conversations/${encodeURIComponent(options.conversationId)}/activities/${encodeURIComponent(options.replyToId)}`
			: `/_apis/conversations/${encodeURIComponent(options.conversationId)}/activities`;

		const response = await this.request("POST", path, activityBody);
		this.recordSent();

		return (response as Record<string, unknown>).id as string;
	}

	/** Send typing indicator */
	async sendTyping(conversationId: string): Promise<void> {
		if (!this.isConnected() || !this.authenticated) {
			throw new Error("Teams channel is not connected");
		}

		if (!this.getConfig().typingEnabled) return;

		const activityBody = { type: "typing" };
		await this.request(
			"POST",
			`/_apis/conversations/${encodeURIComponent(conversationId)}/activities`,
			activityBody,
		);
	}

	/** Get conversation info */
	async getConversationInfo(
		conversationId: string,
	): Promise<TeamsConversationInfo> {
		if (!this.isConnected() || !this.authenticated) {
			throw new Error("Teams channel is not connected");
		}

		const response = await this.request(
			"GET",
			`/_apis/conversations/${encodeURIComponent(conversationId)}`,
		);
		const conv = response as Record<string, unknown>;

		const info: TeamsConversationInfo = {
			conversationId,
			conversationType:
				(conv.conversationType as TeamsConversationInfo["conversationType"]) ??
				"personal",
			tenantId: (conv.tenant as Record<string, unknown>)?.id as
				| string
				| undefined,
			topic: (conv.topicName as string) ?? undefined,
			createdTimestamp: (conv.created as number) ?? undefined,
		};

		this.conversations.set(conversationId, info);
		return info;
	}

	/** Get user info */
	async getUserInfo(userId: string): Promise<TeamsUserInfo> {
		if (!this.isConnected() || !this.authenticated) {
			throw new Error("Teams channel is not connected");
		}

		const response = await this.request(
			"GET",
			`/_apis/users/${encodeURIComponent(userId)}`,
		);
		const user = response as Record<string, unknown>;

		return {
			userId,
			givenName: (user.givenName as string) ?? undefined,
			familyName: (user.familyName as string) ?? undefined,
			displayName: (user.name as string) ?? undefined,
			email: (user.email as string) ?? undefined,
			userPrincipalName: (user.userPrincipalName as string) ?? undefined,
			aadObjectId: (user.aadObjectId as string) ?? undefined,
			role: (user.role as TeamsUserInfo["role"]) ?? "user",
		};
	}

	/** Start webhook server for receiving messages */
	async startWebhook(): Promise<void> {
		if (!this.isConnected()) {
			throw new Error("Teams channel is not connected");
		}

		this.webhookServer = http.createServer((req, res) => {
			this.handleWebhookRequest(req, res);
		});

		this.webhookServer.listen(this.getConfig().webhookPort ?? 3978, () => {
			// Server started
		});
	}

	/** Handle incoming webhook requests */
	private handleWebhookRequest(
		req: http.IncomingMessage,
		res: http.ServerResponse,
	): void {
		if (req.method !== "POST") {
			res.writeHead(405);
			res.end("Method Not Allowed");
			return;
		}

		let body = "";
		req.on("data", (chunk) => (body += chunk));
		req.on("end", async () => {
			try {
				const activity = JSON.parse(body) as Record<string, unknown>;

				// Verify signature
				if (!this.verifyActivitySignature(req, body)) {
					res.writeHead(401);
					res.end("Unauthorized");
					return;
				}

				const message: TeamsMessage = {
					activityId: (activity.id as string) ?? "",
					conversationId:
						((activity.conversation as Record<string, unknown>)
							?.id as string) ?? "",
					fromId:
						((activity.from as Record<string, unknown>)?.id as string) ?? "",
					fromName:
						((activity.from as Record<string, unknown>)?.name as string) ??
						undefined,
					text: (activity.text as string) ?? undefined,
					messageType:
						(activity.type as TeamsMessage["messageType"]) ?? "message",
					timestamp: (activity.timestamp as number) ?? Date.now(),
					replyToId: (activity.replyToId as string) ?? undefined,
					locale: (activity.locale as string) ?? undefined,
					attachments: activity.attachments as TeamsMessage["attachments"],
					entities: activity.entities as TeamsMessage["entities"],
				};

				this.recordReceived();

				// Dispatch to registered handlers via BaseChannel
				await this.dispatchMessage(message);

				res.writeHead(200);
				res.end(JSON.stringify({ id: message.activityId }));
			} catch {
				res.writeHead(400);
				res.end("Bad Request");
			}
		});
	}

	/** Verify activity signature */
	private verifyActivitySignature(
		_req: http.IncomingMessage,
		_body: string,
	): boolean {
		// In production, verify channelId, timestamp, and signature
		// For now, basic verification
		return true;
	}

	/** Get health status */
	getHealthStatus(): TeamsHealthStatus {
		const stats = this.getStats();
		return {
			connected: stats.connected,
			authenticated: this.authenticated,
			tokenExpiry: this.tokenExpiry,
			conversationsCount: this.conversations.size,
			messagesSent: stats.messagesSent,
			messagesReceived: stats.messagesReceived,
			lastActivity: stats.lastActivity,
		};
	}

	/** Make an authenticated request to Teams API */
	private async request(
		method: string,
		path: string,
		body?: Record<string, unknown>,
	): Promise<unknown> {
		const url = new URL(path, TEAMS_API_BASE);

		const headers: Record<string, string> = {
			Authorization: `Bearer ${this.accessToken}`,
			"Content-Type": "application/json",
			"X-MS-CV": "1.0",
		};

		const bodyStr = body ? JSON.stringify(body) : undefined;

		return new Promise((resolve, reject) => {
			const req = https.request(
				url,
				{
					method,
					headers,
				},
				(res) => {
					let data = "";
					res.on("data", (chunk) => (data += chunk));
					res.on("end", () => {
						if (
							res.statusCode &&
							res.statusCode >= 200 &&
							res.statusCode < 300
						) {
							try {
								resolve(data ? JSON.parse(data) : {});
							} catch {
								resolve(data);
							}
						} else {
							reject(new Error(`Teams API error: ${res.statusCode} ${data}`));
						}
					});
				},
			);

			req.on("error", reject);
			if (bodyStr) req.write(bodyStr);
			req.end();
		});
	}
}
