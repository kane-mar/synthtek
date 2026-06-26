/**
 * Telegram API Client Tests
 * Tests for the extracted TelegramApiClient module.
 */
import { equal, ok, rejects } from "node:assert";
import { describe, it } from "node:test";
import { TelegramApiClient } from "../../../src/channels/telegram/api.js";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("TelegramApiClient", () => {
	const validConfig = {
		token: "test-token-12345",
		pollingTimeout: 30,
		maxRetries: 3,
		retryDelay: 1000,
	};

	it("creates a client with token config", () => {
		const client = new TelegramApiClient(validConfig);
		ok(client);
	});

	it("throws for invalid token", async () => {
		const client = new TelegramApiClient({ token: "" });
		await rejects(client.apiCall("getMe"), /Telegram API error/);
	});

	it("formats API URL correctly", () => {
		const client = new TelegramApiClient(validConfig as any);
		// Access getApiUrl to verify URL construction
		const url = (client as any).getApiUrl("getMe");
		ok(url.includes("test-token-12345"), "URL should contain token");
		ok(url.includes("getMe"), "URL should contain method name");
		ok(
			url.startsWith("https://api.telegram.org/bot"),
			"URL should start with API base",
		);
	});

	it("supports different HTTP methods for API calls", () => {
		// GET_METHODS is a static readonly set on TelegramApiClient
		const getMethods = TelegramApiClient.GET_METHODS;
		ok(getMethods.has("getMe"), "getMe should be a GET method");
		ok(getMethods.has("getUpdates"), "getUpdates should be a GET method");
		ok(getMethods.has("getFile"), "getFile should be a GET method");
		ok(getMethods.has("getChat"), "getChat should be a GET method");
	});

	it("respects retry configuration", () => {
		const client = new TelegramApiClient({
			...validConfig,
			maxRetries: 5,
			retryDelay: 2000,
		});
		ok(client);
		// Verify config access
		equal((client as any).config.maxRetries, 5);
		equal((client as any).config.retryDelay, 2000);
	});
});
