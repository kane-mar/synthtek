/**
 * WeCom Channel — WeCom SDK integration for synthtek
 */

import https from "node:https";
import { BaseChannel } from "../base-channel.js";
import type {
	WeComConfig,
	WeComHealthStatus,
	WeComMessage,
	WeComSendOptions,
	WeComSendResult,
} from "./types.js";

const API_BASE = "https://qyapi.weixin.qq.com";
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;
const DEFAULT_TOKEN_TTL = 7000;

export class WeComChannel extends BaseChannel<WeComConfig, WeComMessage> {
	private accessToken: string | undefined;
	private tokenExpiry: number | undefined;

	constructor(config: WeComConfig) {
		super({
			apiBaseUrl: API_BASE,
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
				`WeCom connection failed: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}
	}

	async disconnect(): Promise<void> {
		this.markDisconnected();
		this.accessToken = undefined;
	}

	private async authenticate(): Promise<void> {
		const config = this.getConfig();
		const response = await this.requestRaw(
			"GET",
			`/cgi-bin/gettoken?corpid=${encodeURIComponent(config.corpId)}&corpsecret=${encodeURIComponent(config.agentSecret)}`,
		);

		const data = response as Record<string, unknown>;
		if ((data.errcode as number) !== 0) {
			throw new Error(
				`Auth failed: ${(data.errmsg as string) ?? "Unknown error"}`,
			);
		}

		this.accessToken = data.access_token as string;
		this.tokenExpiry =
			Date.now() + ((data.expires_in as number) ?? config.tokenTtl!) * 1000;
	}

	async sendMessage(options: WeComSendOptions): Promise<WeComSendResult> {
		if (!this.isConnected()) {
			return {
				success: false,
				errorCode: -1,
				errorMessage: "WeCom channel is not connected",
			};
		}

		if (this.tokenExpiry && Date.now() >= this.tokenExpiry) {
			await this.authenticate();
		}

		const config = this.getConfig();
		const userIds = Array.isArray(options.userIds)
			? options.userIds.join("|")
			: options.userIds;

		const body: Record<string, unknown> = {
			touser: userIds,
			msgtype: options.msgType,
			agent_id: config.agentId,
		};

		if (options.partyIds) body.toparty = options.partyIds.join("|");
		if (options.tagIds) body.totag = options.tagIds.join("|");
		if (options.enableDuplicateCheck) body.enable_duplicate_check = true;

		switch (options.msgType) {
			case "text":
				body.text = { content: options.content ?? "" };
				break;
			case "markdown":
				body.markdown = { content: options.content ?? "" };
				break;
			case "image":
				body.image = { media_id: options.mediaId };
				break;
			case "voice":
				body.voice = { media_id: options.mediaId };
				break;
			case "video":
				body.video = {
					media_id: options.mediaId,
					title: options.title,
					description: options.description,
				};
				break;
			case "file":
				body.file = { media_id: options.mediaId };
				break;
			case "textcard":
				body.textcard = {
					title: options.title ?? "",
					description: options.description ?? "",
					url: options.url ?? "",
				};
				break;
		}

		try {
			const response = await this.request(
				"POST",
				"/cgi-bin/message/send",
				body,
			);
			const data = response as Record<string, unknown>;

			this.recordSent();

			return {
				success: (data.errcode as number) === 0,
				errorCode: (data.errcode as number) ?? undefined,
				errorMessage: (data.errmsg as string) ?? undefined,
				invalidUsers: (data.invaliduser as string) ?? undefined,
				invalidParties: (data.invalidparty as string) ?? undefined,
			};
		} catch (err) {
			return {
				success: false,
				errorMessage: err instanceof Error ? err.message : "Unknown error",
			};
		}
	}

	getHealthStatus(): WeComHealthStatus {
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
		const tokenPath = path.includes("?")
			? `${path}&access_token=${this.accessToken}`
			: `${path}?access_token=${this.accessToken}`;

		return this.requestRaw(method, tokenPath, body);
	}

	private async requestRaw(
		method: string,
		path: string,
		body?: Record<string, unknown>,
	): Promise<unknown> {
		const config = this.getConfig();
		const url = new URL(path, config.apiBaseUrl ?? API_BASE);
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
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
