/**
 * ChatService Tests — Unified messaging across all interfaces
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ChatService } from "../../src/messaging/chat-service.js";
import type {
	ChatState,
	LLMProviderConfig,
} from "../../src/messaging/types.js";

describe("ChatService", () => {
	it("creates a service instance with default state", () => {
		const service = new ChatService({} as never);
		const state = service.getState();
		assert.equal(state.isLoading, false);
		assert.equal(state.isStreaming, false);
		assert.equal(state.error, null);
	});

	it("notifies state change listeners", () => {
		const service = new ChatService({} as never);
		const states: ChatState[] = [];
		service.onStateChange((s) => states.push({ ...s }));

		// Start loading
		service.setLoading(true);
		assert.equal(states.length, 1);
		assert.equal(states[0].isLoading, true);

		// Clear loading
		service.setLoading(false);
		assert.equal(states.length, 2);
		assert.equal(states[1].isLoading, false);
	});

	it("sets error state", () => {
		const service = new ChatService({} as never);
		const states: ChatState[] = [];
		service.onStateChange((s) => states.push({ ...s }));

		service.setError("Something went wrong");
		assert.equal(states.length, 1);
		assert.equal(states[0].error, "Something went wrong");

		service.clearError();
		assert.equal(states.length, 2);
		assert.equal(states[1].error, null);
	});

	it("returns error when no provider is available", async () => {
		const mockProviderManager = {
			list: () => [],
		};
		const service = new ChatService(mockProviderManager as never);
		const result = await service.sendMessage({
			messages: [{ role: "user", content: "Hello" }],
		});
		assert.ok(result.error);
		assert.ok(result.error!.includes("No active LLM providers"));
	});

	it("selects specified provider when available", async () => {
		const providers: LLMProviderConfig[] = [
			{
				id: "provider-1",
				name: "Provider 1",
				type: "openai",
				status: "active",
				apiKey: "sk-test",
				baseUrl: "",
				models: [],
				defaultModel: "gpt-3.5-turbo",
				temperature: 0.7,
				maxTokens: 2048,
			},
		];
		const mockProviderManager = {
			list: () => providers,
			find: (id: string) => providers.find((p) => p.id === id) || null,
		};
		const service = new ChatService(mockProviderManager as never);
		const result = await service.sendMessage({
			messages: [{ role: "user", content: "Hello" }],
			providerId: "provider-1",
		});
		// Should fail because provider type "openai" requires real API key
		// But the key thing is it ATTEMPTED to use the specified provider
		assert.ok(result.error);
		assert.ok(
			!result.error!.includes("No active LLM providers"),
			"Should not be 'no providers' error — should attempt to use specified provider",
		);
	});

	it("tracks loading state through message lifecycle", async () => {
		const providers: LLMProviderConfig[] = [
			{
				id: "p1",
				name: "P1",
				type: "openai",
				status: "active",
				apiKey: "sk-xxx",
				baseUrl: "http://localhost:9999",
				models: [],
				defaultModel: "gpt-3.5-turbo",
				temperature: 0.7,
				maxTokens: 2048,
			},
		];
		const mockProviderManager = {
			list: () => providers,
			find: (id: string) => providers.find((p) => p.id === id) || null,
		};
		const service = new ChatService(mockProviderManager as never);
		const states: ChatState[] = [];
		service.onStateChange((s) => states.push({ ...s }));

		// This will fail to connect (localhost:9999), but we track state
		await service.sendMessage({
			messages: [{ role: "user", content: "Hi" }],
		});

		// Loading should have been set and cleared
		const loadingSet = states.filter((s) => s.isLoading);
		const loadingCleared = states.filter((s) => !s.isLoading);
		assert.ok(loadingSet.length >= 1, "Loading should be set");
		assert.ok(loadingCleared.length >= 1, "Loading should be cleared");
	});

	it("can be reset to default state", () => {
		const service = new ChatService({} as never);
		service.setError("old error");
		service.setLoading(true);
		service.reset();
		const state = service.getState();
		assert.equal(state.isLoading, false);
		assert.equal(state.isStreaming, false);
		assert.equal(state.error, null);
	});

	it("builds system-prefixed message array", () => {
		const service = new ChatService({} as never);
		const messages = [{ role: "user" as const, content: "Hi" }];
		const result = service.buildRequestMessages(messages, "You are a bot.");
		assert.equal(result.length, 2);
		assert.equal(result[0].role, "system");
		assert.equal(result[0].content, "You are a bot.");
	});

	it("returns messages unchanged when no system prompt", () => {
		const service = new ChatService({} as never);
		const messages = [{ role: "user" as const, content: "Hi" }];
		const result = service.buildRequestMessages(messages, undefined);
		assert.equal(result.length, 1);
		assert.equal(result[0].role, "user");
	});

	it("uses completion handler when provided", async () => {
		const service = new ChatService(
			{
				list: () => [
					{
						id: "p1",
						name: "P1",
						type: "openai",
						status: "active",
						apiKey: "",
						baseUrl: "",
						models: [],
						defaultModel: "gpt-3.5-turbo",
						temperature: 0.7,
						maxTokens: 2048,
					},
				],
				find: () => null,
			},
			{
				completionHandler: async (provider, messages) => {
					assert.equal(provider.id, "p1");
					assert.equal(messages.length, 2); // system + user
					assert.equal(messages[0].role, "system");
					return { content: "Hello from handler!" };
				},
			},
		);
		const result = await service.sendMessage({
			messages: [{ role: "user", content: "Hi" }],
			system: "You are helpful.",
		});
		assert.equal(result.content, "Hello from handler!");
		assert.equal(result.error, undefined);
	});

	it("reports errors from completion handler", async () => {
		const service = new ChatService(
			{
				list: () => [
					{
						id: "p1",
						name: "P1",
						type: "openai",
						status: "active",
						apiKey: "",
						baseUrl: "",
						models: [],
						defaultModel: "gpt-3.5-turbo",
						temperature: 0.7,
						maxTokens: 2048,
					},
				],
				find: () => null,
			},
			{
				completionHandler: async () => {
					throw new Error("API timeout");
				},
			},
		);
		const result = await service.sendMessage({
			messages: [{ role: "user", content: "Hi" }],
		});
		assert.ok(result.error);
		assert.ok(result.error!.includes("API timeout"));
	});

	it("tracks isStreaming state", () => {
		const service = new ChatService({} as never);
		const states: ChatState[] = [];
		service.onStateChange((s) => states.push({ ...s }));
		service.setStreaming(true);
		assert.equal(states[0].isStreaming, true);
		service.setStreaming(false);
		assert.equal(states[1].isStreaming, false);
	});
});
