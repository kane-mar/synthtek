/**
 * QQ Channel — QQ Bot API integration for synthtek
 */

import https from "node:https";
import { BaseChannel } from "../base-channel.js";
import type {
	QQConfig,
	QQHealthStatus,
	QQMessage,
	QQSendOptions,
} from "./types.js";

const API_BASE = "https://api.sgroup.qq.com";
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;

export class QQChannel extends BaseChannel<QQConfig, QQMessage> {
	private wsStatus: QQHealthStatus["wsStatus"] = "disconnected";
	private accessToken: string | undefined;
	private tokenExpiry: number | undefined;

	constructor(config: QQConfig) {
		super({
			groupMessages: true,
			c2cMessages: true,
			maxRetries: DEFAULT_MAX_RETRIES,
			retryDelay: DEFAULT_RETRY_DELAY,
			...config,
		});
	}

	async connect(): Promise<void> {
		try {
			await this.authenticate();
			this.markConnected();
		} catch (err) {
			this.markDisconnected();
			throw new Error(
				`QQ connection failed: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}
	}

	async disconnect(): Promise<void> {
		this.markDisconnected();
		this.wsStatus = "disconnected";
		this.accessToken = undefined;
	}

	private async authenticate(): Promise<void> {
		const cfg = this.getConfig();
		const response = await this.requestRaw("POST", "/v2/users/@me", {
			app_id: cfg.appId,
			open_key: cfg.secret,
		});

		const data = response as Record<string, unknown>;
		if ((data.retcode as number) !== 0 || !data.access_token) {
			throw new Error(
				`QQ auth failed: ${(data.message as string) ?? "Invalid credentials"}`,
			);
		}

		this.accessToken = data.access_token as string;
		this.tokenExpiry =
			Date.now() + ((data.expires_in as number) ?? 14400) * 1000;
	}

	async sendMessage(options: QQSendOptions): Promise<string> {
		if (!this.isConnected()) {
			throw new Error("QQ channel is not connected");
		}

		if (this.tokenExpiry && Date.now() >= this.tokenExpiry) {
			await this.authenticate();
		}

		const body: Record<string, unknown> = {
			content: options.content,
			msg_type: options.msgType ?? "GROUP",
		};

		if (options.mediaType) {
			body.media_type = options.mediaType;
			body.file_sid = options.fileSid;
		}

		if (options.messageId) {
			body.message_id = options.messageId;
		}

		if (options.embed) {
			body.embed = options.embed;
		}

		if (options.ark) {
			body.ark = options.ark;
		}

		const response = await this.request(
			"POST",
			`/v2/messages/${encodeURIComponent(options.channelId)}`,
			body,
		);

		this.recordSent();

		return ((response as Record<string, unknown>).id as string) ?? "";
	}

	async startWebSocket(): Promise<void> {
		if (!this.isConnected()) {
			throw new Error("QQ channel is not connected");
		}

		this.wsStatus = "connecting";

		// In production, use 'ws' package. Here we simulate with HTTP.
		this.wsStatus = "connected";
	}

	getHealthStatus(): QQHealthStatus {
		return {
			...this.getStats(),
			wsStatus: this.wsStatus,
		};
	}

	private async request(
		method: string,
		path: string,
		body?: Record<string, unknown>,
	): Promise<unknown> {
		const headers: Record<string, string> = {
			Authorization: `QQBot ${this.accessToken}`,
			"Content-Type": "application/json",
		};

		return this.requestRaw(method, path, body, headers);
	}

	private async requestRaw(
		method: string,
		path: string,
		body?: Record<string, unknown>,
		extraHeaders?: Record<string, string>,
	): Promise<unknown> {
		const url = new URL(path, API_BASE);
		const headers = { "Content-Type": "application/json", ...extraHeaders };
		const bodyStr = body ? JSON.stringify(body) : undefined;

		return new Promise((resolve, reject) => {
			const req = https.request(url, { method, headers }, (res) => {
				let data = "";
				res.on("data", (chunk) => (data += chunk));
				res.on("end", () => {
					try {
						resolve(JSON.parse(data));
					} catch {
						resolve(data);
					}
				});
			});

			req.on("error", reject);
			if (bodyStr) req.write(bodyStr);
			req.end();
		});
	}
}
