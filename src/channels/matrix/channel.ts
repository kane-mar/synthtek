/**
 * Matrix Channel — matrix-nio integration for synthtek
 * Implements Matrix Client-Server API for message sending/receiving
 */

import http from "node:http";
import https from "node:https";
import { URL } from "node:url";
import { BaseChannel } from "../base-channel.js";
import type {
	MatrixConfig,
	MatrixHealthStatus,
	MatrixMessage,
	MatrixRoomInfo,
	MatrixSendOptions,
	MatrixUserInfo,
} from "./types.js";

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;
const SYNC_TIMEOUT_MS = 30000;

// ─── Constants ─────────────────────────────────────────────────────────────
export class MatrixChannel extends BaseChannel<MatrixConfig, MatrixMessage> {
	private syncToken: string | undefined;
	private rooms: Map<string, MatrixRoomInfo> = new Map();
	private lastSync: number | undefined;
	private syncAbortController: AbortController | null = null;
	private retryCount = 0;

	constructor(config: MatrixConfig) {
		super({
			maxRetries: DEFAULT_MAX_RETRIES,
			retryDelay: DEFAULT_RETRY_DELAY,
			e2eEnabled: false,
			presence: "online",
			...config,
		});
	}

	/** Connect to Matrix homeserver */

	// ─── Lifecycle ─────────────────────────────────────────────────────────────
	async connect(): Promise<void> {
		try {
			await this.verifyToken();
			this.markConnected();
			this.retryCount = 0;
		} catch (err) {
			throw new Error(
				`Matrix connection failed: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}
	}

	/** Disconnect from Matrix */
	async disconnect(): Promise<void> {
		this.markDisconnected();
		if (this.syncAbortController) {
			this.syncAbortController.abort();
			this.syncAbortController = null;
		}
	}

	/** Verify access token is valid */
	private async verifyToken(): Promise<void> {
		await this.request("GET", "/_matrix/client/v3/account/whoami");
	}

	/** Send a text message to a room */

	// ─── Message Sending ─────────────────────────────────────────────────────
	async sendMessage(options: MatrixSendOptions): Promise<string> {
		if (!this.isConnected()) {
			throw new Error("Matrix channel is not connected");
		}

		const body: Record<string, unknown> = {
			msgtype: options.msgType ?? "m.text",
			body: options.body,
		};

		if (options.formattedBody) {
			body.format = "org.matrix.custom.html";
			body.formatted_body = options.formattedBody;
		}

		if (options.inReplyTo) {
			body["m.relates_to"] = {
				"m.in_reply_to": { event_id: options.inReplyTo },
			};
		}

		if (options.threadRoot) {
			body["m.relates_to"] = {
				rel_type: "m.thread",
				event_id: options.threadRoot,
				...(options.inReplyTo
					? { "m.in_reply_to": { event_id: options.inReplyTo } }
					: {}),
			};
		}

		const response = await this.request(
			"POST",
			`/_matrix/client/v3/rooms/${encodeURIComponent(options.roomId)}/send/m.room.message`,
			{ json: body },
		);

		this.recordSent();
		return (response as Record<string, unknown>).event_id as string;
	}

	/** Send a reaction to a message */
	async addReaction(
		roomId: string,
		eventId: string,
		key: string,
	): Promise<string> {
		if (!this.isConnected()) {
			throw new Error("Matrix channel is not connected");
		}

		const body = {
			"m.relates_to": {
				rel_type: "m.annotation",
				event_id: eventId,
				key,
			},
		};

		const response = await this.request(
			"POST",
			`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.reaction`,
			{ json: body },
		);

		return (response as Record<string, unknown>).event_id as string;
	}

	/** Remove a reaction */
	async removeReaction(roomId: string, eventId: string): Promise<void> {
		if (!this.isConnected()) {
			throw new Error("Matrix channel is not connected");
		}

		await this.request(
			"DELETE",
			`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.reaction/${eventId}`,
		);
	}

	/** Get room info */
	async getRoomInfo(roomId: string): Promise<MatrixRoomInfo> {
		if (!this.isConnected()) {
			throw new Error("Matrix channel is not connected");
		}

		const [state, members] = await Promise.all([
			this.request(
				"GET",
				`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state`,
			),
			this.request(
				"GET",
				`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/members`,
			),
		]);

		const stateData = state as Record<string, unknown>;
		const memberData = members as Record<string, unknown>;

		const info: MatrixRoomInfo = {
			roomId,
			name: (stateData.name as string) ?? undefined,
			topic: (stateData.topic as string) ?? undefined,
			worldReadable: (stateData.join_rule as string) === "public",
			guestCanJoin: (stateData.guest_access as string) === "can_join",
			memberCount: (memberData.chunk as Array<unknown>)?.length ?? 0,
			avatarUrl: (stateData.avatar_url as string) ?? undefined,
			canonicalAlias: (stateData.canonical_alias as string) ?? undefined,
		};

		this.rooms.set(roomId, info);
		return info;
	}

	/** Get user info */
	async getUserInfo(userId: string): Promise<MatrixUserInfo> {
		if (!this.isConnected()) {
			throw new Error("Matrix channel is not connected");
		}

		const [profile, presence] = await Promise.all([
			this.request(
				"GET",
				`/_matrix/client/v3/profile/${encodeURIComponent(userId)}`,
			),
			this.request(
				"GET",
				`/_matrix/client/v3/presence/${encodeURIComponent(userId)}/status`,
			),
		]);

		const profileData = profile as Record<string, unknown>;
		const presenceData = presence as Record<string, unknown>;

		return {
			userId,
			displayName: (profileData.displayname as string) ?? undefined,
			avatarUrl: (profileData.avatar_url as string) ?? undefined,
			presence:
				(presenceData.presence as MatrixUserInfo["presence"]) ?? "offline",
			statusMsg: (presenceData.status_msg as string) ?? undefined,
		};
	}

	/** Start sync loop */
	async startSync(): Promise<void> {
		if (!this.isConnected()) {
			throw new Error("Matrix channel is not connected");
		}

		this.syncAbortController = new AbortController();
		await this.syncLoop(this.syncAbortController.signal);
	}

	/** Sync loop */
	private async syncLoop(signal: AbortSignal): Promise<void> {
		while (!signal.aborted) {
			try {
				const response = await this.requestWithTimeout(
					"GET",
					`/_matrix/client/v3/sync?timeout=${SYNC_TIMEOUT_MS}${
						this.syncToken ? `&since=${this.syncToken}` : ""
					}`,
					SYNC_TIMEOUT_MS,
				);

				const data = response as Record<string, unknown>;
				this.syncToken = (data.next_batch as string) ?? this.syncToken;
				this.lastSync = Date.now();

				// Process events
				const roomsData = (data.rooms as Record<string, unknown>)?.join as
					| Record<string, Record<string, unknown>>
					| undefined;
				if (!roomsData) continue;

				for (const room of Object.values(roomsData)) {
					const timeline = room.timeline as Record<string, unknown> | undefined;
					const events = timeline?.events as
						| Array<Record<string, unknown>>
						| undefined;
					if (!events) continue;

					const roomId = (room.room_id as string) ?? "";

					for (const event of events) {
						if (event.type === "m.room.message") {
							const message = this.parseMessageEvent(event, roomId);
							this.recordReceived();
							await this.dispatchMessage(message);
						}
					}
				}
			} catch (err) {
				if (signal.aborted) break;
				this.retryCount++;
				if (
					this.retryCount > (this.getConfig().maxRetries ?? DEFAULT_MAX_RETRIES)
				) {
					this.emitError(
						err instanceof Error ? err : new Error(String(err)),
						false,
					);
					break;
				}
				const delay =
					(this.getConfig().retryDelay ?? DEFAULT_RETRY_DELAY) *
					this.retryCount;
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}
	}

	/** Set presence status */
	async setPresence(
		status: "online" | "offline" | "unavailable",
	): Promise<void> {
		if (!this.isConnected()) {
			throw new Error("Matrix channel is not connected");
		}

		await this.request(
			"PUT",
			`/_matrix/client/v3/presence/${encodeURIComponent(this.getConfig().userId)}/status`,
			{ json: { presence: status } },
		);
	}

	/** Send typing indicator */
	async sendTyping(
		roomId: string,
		typing: boolean,
		duration = 2500,
	): Promise<void> {
		if (!this.isConnected()) {
			throw new Error("Matrix channel is not connected");
		}

		await this.request(
			"PUT",
			`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/typing/${encodeURIComponent(this.getConfig().userId)}`,
			{ json: { typing, timeout: duration } },
		);
	}

	/** Get health status */

	// ─── Health & Stats ─────────────────────────────────────────────────────────
	getHealthStatus(): MatrixHealthStatus {
		const stats = this.getStats();
		return {
			connected: stats.connected,
			syncToken: this.syncToken,
			roomsCount: this.rooms.size,
			e2eEnabled: this.getConfig().e2eEnabled ?? false,
			lastSync: this.lastSync,
		};
	}

	/** Parse a message event into a MatrixMessage */
	private parseMessageEvent(
		event: Record<string, unknown>,
		roomId: string,
	): MatrixMessage {
		const content = (event.content as Record<string, unknown>) ?? {};
		const relatesTo = content["m.relates_to"] as
			| Record<string, unknown>
			| undefined;

		let relation: MatrixMessage["relation"];
		let inReplyTo: string | undefined;

		if (relatesTo) {
			if (relatesTo.rel_type === "m.thread") {
				relation = {
					rel_type: "m.thread",
					event_id: relatesTo.event_id as string | undefined,
				};
			} else if (relatesTo["m.in_reply_to"]) {
				inReplyTo = (relatesTo["m.in_reply_to"] as Record<string, unknown>)
					?.event_id as string | undefined;
				relation = { rel_type: "reply", in_reply_to_event: inReplyTo };
			}
		}

		return {
			eventId: (event.event_id as string) ?? "",
			roomId,
			senderId: (event.sender as string) ?? "",
			body: (content.body as string) ?? "",
			msgType: (content.msgtype as MatrixMessage["msgType"]) ?? "m.text",
			formattedBody: (content.formatted_body as string) ?? undefined,
			timestamp: (event.ts as number) ?? Date.now(),
			inReplyTo,
			relation,
		};
	}

	/** Make an HTTP request to the Matrix homeserver */
	private async request(
		method: string,
		path: string,
		options?: { json?: Record<string, unknown>; timeout?: number },
	): Promise<unknown> {
		const config = this.getConfig();
		const baseUrl = new URL(config.homeserver);
		const url = new URL(path, baseUrl);

		const headers: Record<string, string> = {
			Authorization: `Bearer ${config.accessToken}`,
			"Content-Type": "application/json",
		};

		if (config.deviceId) {
			headers["X-Matrix-Client-Id"] = config.deviceId;
		}

		const body = options?.json ? JSON.stringify(options.json) : undefined;

		return this.makeHttpRequest(
			url,
			method,
			headers,
			body,
			options?.timeout ?? 10000,
		);
	}

	/** Make an HTTP request with timeout */
	private async requestWithTimeout(
		method: string,
		path: string,
		timeout: number,
	): Promise<unknown> {
		return this.request(method, path, { timeout });
	}

	/** Low-level HTTP request */
	private makeHttpRequest(
		url: URL,
		method: string,
		headers: Record<string, string>,
		body: string | undefined,
		timeout: number,
	): Promise<unknown> {
		return new Promise((resolve, reject) => {
			const transport = url.protocol === "https:" ? https : http;

			const requestOptions: https.RequestOptions = {
				hostname: url.hostname,
				port: url.port || (url.protocol === "https:" ? 443 : 80),
				path: url.pathname + url.search,
				method,
				headers,
				timeout,
			};

			const req = transport.request(requestOptions, (res) => {
				let data = "";
				res.on("data", (chunk) => (data += chunk));
				res.on("end", () => {
					if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
						try {
							resolve(JSON.parse(data));
						} catch {
							resolve(data);
						}
					} else {
						reject(new Error(`Matrix API error: ${res.statusCode} ${data}`));
					}
				});
			});

			req.on("error", reject);
			req.on("timeout", () => {
				req.destroy();
				reject(new Error("Matrix request timeout"));
			});

			if (body) req.write(body);
			req.end();
		});
	}
}
