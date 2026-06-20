/**
 * DingTalk Channel — DingTalk Stream integration for synthtek
 */

import https from "node:https";
import { BaseChannel } from "../base-channel.js";
import type {
	DingTalkConfig,
	DingTalkHealthStatus,
	DingTalkMessage,
	DingTalkSendOptions,
	DingTalkSendResult,
} from "./types.js";

const API_BASE = "https://api.dingtalk.com";
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;
const DEFAULT_TOKEN_TTL = 7000;

export class DingTalkChannel extends BaseChannel<
	DingTalkConfig,
	DingTalkMessage
> {
	private accessToken: string | undefined;
	private tokenExpiry: number | undefined;

	constructor(config: DingTalkConfig) {
		super({
			streamUrl: "https://api-dingtalk.dingtalk.com",
			maxRetries: DEFAULT_MAX_RETRIES,
			retryDelay: DEFAULT_RETRY_DELAY,
			tokenTtl: DEFAULT_TOKEN_TTL,
			...config,
		});
	}

	async connect(): Promise<void> {
		try {
			await this.authenticate();
			this.markConnected();
		} catch (err) {
			throw new Error(
				`DingTalk connection failed: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}
	}

	async disconnect(): Promise<void> {
		this.markDisconnected();
		this.accessToken = undefined;
	}

	private async authenticate(): Promise<void> {
		const config = this.getConfig();
		const response = await this.requestRaw("POST", "/v1.0/oauth2/accessToken", {
			appKey: config.clientId,
			appSecret: config.clientSecret,
		});

		const data = response as Record<string, unknown>;
		if ((data.errcode as number) !== 0) {
			throw new Error(
				`Auth failed: ${(data.errmsg as string) ?? "Unknown error"}`,
			);
		}

		this.accessToken = data.access_token as string;
		this.tokenExpiry =
			Date.now() + ((data.expire_in as number) ?? config.tokenTtl!) * 1000;
	}

	async sendMessage(options: DingTalkSendOptions): Promise<DingTalkSendResult> {
		if (!this.isConnected()) {
			return {
				success: false,
				errorCode: -1,
				errorMessage: "DingTalk channel is not connected",
			};
		}

		if (this.tokenExpiry && Date.now() >= this.tokenExpiry) {
			await this.authenticate();
		}

		const body: Record<string, unknown> = {
			robotCode: options.robotCode ?? this.getConfig().clientId,
			conversationId: options.conversationId,
			msgKey: options.msgKey,
			msgData: options.msgData,
		};

		try {
			const response = await this.request(
				"POST",
				"/v1.0/robot/oToMessages/batchSend",
				body,
			);
			const data = response as Record<string, unknown>;

			this.recordSent();

			return {
				success: (data.errcode as number) === 0,
				messageId: (data.result as string) ?? undefined,
				errorCode: (data.errcode as number) ?? undefined,
				errorMessage: (data.errmsg as string) ?? undefined,
			};
		} catch (err) {
			return {
				success: false,
				errorMessage: err instanceof Error ? err.message : "Unknown error",
			};
		}
	}

	getHealthStatus(): DingTalkHealthStatus {
		const stats = this.getStats();
		return {
			connected: stats.connected,
			tokenValid:
				this.accessToken !== undefined &&
				(!this.tokenExpiry || Date.now() < this.tokenExpiry),
			tokenExpiry: this.tokenExpiry,
			messagesSent: stats.messagesSent,
			messagesReceived: stats.messagesReceived,
		};
	}

	private async request(
		method: string,
		path: string,
		body?: Record<string, unknown>,
	): Promise<unknown> {
		const headers: Record<string, string> = {
			"x-acs-dingtalk-access-token": this.accessToken ?? "",
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
