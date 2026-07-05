/**
 * Telegram API Client
 * Raw Telegram Bot API calls with retry logic.
 * Extracted from TelegramChannel for modularity (H8).
 */

import { sleep } from "./format.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const API_BASE = "https://api.telegram.org/bot";
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 500;
const HTTP_TIMEOUT = 30_000;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TelegramApiConfig {
	token: string;
	pollingTimeout?: number;
	maxRetries?: number;
	retryDelay?: number;
}

// ─── API Client ──────────────────────────────────────────────────────────────

export class TelegramApiClient {
	/** Read-only API methods that use GET instead of POST */
	static readonly GET_METHODS = new Set([
		"getMe",
		"getUpdates",
		"getFile",
		"getChat",
		"getChatAdministrators",
		"getChatMemberCount",
		"getChatMember",
		"getWebhookInfo",
		"getUserProfilePhotos",
	]);
	private config: Required<TelegramApiConfig>;

	constructor(config: TelegramApiConfig) {
		this.config = {
			token: config.token,
			pollingTimeout: config.pollingTimeout ?? 30,
			maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
			retryDelay: config.retryDelay ?? DEFAULT_RETRY_DELAY_MS,
		};
	}

	/**
	 * Build the full API URL for a method.
	 */
	getApiUrl(method: string): string {
		return `${API_BASE}${this.config.token}/${method}`;
	}

	/**
	 * Check if a method uses GET (read-only) or POST.
	 */
	isGetMethod(method: string): boolean {
		return TelegramApiClient.GET_METHODS.has(method);
	}

	/**
	 * Make a raw API call with retry logic, returning the Response object.
	 * Use this for backward compatibility with code that reads response headers.
	 */
	async apiCallRaw(
		method: string,
		body?: Record<string, unknown>,
	): Promise<Response> {
		return this.executeCallRaw(method, body);
	}

	/**
	 * Make an API call with retry logic, returning parsed JSON.
	 */
	async apiCall<T>(method: string, body?: Record<string, unknown>): Promise<T> {
		return this.apiCallWithRetry<T>(method, body);
	}

	/**
	 * API call with retry logic (exponential backoff).
	 */
	private async apiCallWithRetry<T>(
		method: string,
		body?: Record<string, unknown>,
	): Promise<T> {
		const maxRetries = this.config.maxRetries;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				const response = await this.executeCallRaw(method, body);
				return response.json() as Promise<T>;
			} catch (error: unknown) {
				const err = error instanceof Error ? error : new Error(String(error));
				const isRateLimited =
					err.message.includes("429") || err.message.includes("flood");
				if (isRateLimited && attempt < maxRetries) {
					const delay = this.config.retryDelay * 2 ** (attempt - 1);
					console.warn(
						`[Telegram] Rate limited (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms`,
					);
					await sleep(delay);
					continue;
				}
				const isTimeout =
					err.name === "AbortError" || err.message.includes("timeout");
				if (isTimeout && attempt < maxRetries) {
					const delay = this.config.retryDelay * 2 ** (attempt - 1);
					console.warn(
						`[Telegram] Timeout (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms`,
					);
					await sleep(delay);
					continue;
				}
				throw error;
			}
		}
		throw new Error(`Failed after ${maxRetries} retries`);
	}

	/**
	 * Execute a single API call (no retry), returning the raw Response.
	 */
	private async executeCallRaw(
		method: string,
		body?: Record<string, unknown>,
	): Promise<Response> {
		const url = this.getApiUrl(method);
		const isGetMethod = this.isGetMethod(method);

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT);

		try {
			const finalUrl =
				isGetMethod && body
					? `${url}?${new URLSearchParams(
							Object.entries(body).map(([k, v]) => [k, String(v)]),
						)}`
					: url;

			const response = await fetch(finalUrl, {
				method: isGetMethod ? "GET" : "POST",
				headers: isGetMethod
					? undefined
					: { "Content-Type": "application/json" },
				signal: controller.signal,
				body: isGetMethod ? undefined : JSON.stringify(body ?? {}),
			});

			if (!response.ok) {
				const errorText = await response.text().catch(() => "Unknown error");
				throw new Error(
					`Telegram API error (${response.status}): ${errorText}`,
				);
			}

			return response;
		} finally {
			clearTimeout(timeout);
		}
	}
}
