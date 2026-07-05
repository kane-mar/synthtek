/**
 * Qwen Provider Tests
 */

import assert from "node:assert/strict";
import test from "node:test";
import { QwenProvider } from "../../src/providers/qwen/provider.js";
import type { ProviderConfig } from "../../src/providers/types.js";

const TEST_CONFIG: ProviderConfig = {
	provider: "qwen",
	apiKey: "test-key",
	model: "qwen-max",
};

test("QwenProvider has correct name", () => {
	const provider = new QwenProvider(TEST_CONFIG);
	assert.equal(provider.name, "qwen");
});

test("QwenProvider returns config", () => {
	const provider = new QwenProvider(TEST_CONFIG);
	const config = provider.getConfig();

	assert.equal(config.provider, "qwen");
	assert.equal(config.apiKey, "test-key");
	assert.equal(config.model, "qwen-max");
	assert.equal(
		config.baseUrl,
		"https://dashscope.aliyuncs.com/compatible-mode/v1",
	);
	assert.equal(config.timeout, 60_000);
	assert.equal(config.retries, 3);
	assert.equal(config.retryDelay, 1000);
});

test("QwenProvider uses default baseUrl", () => {
	const provider = new QwenProvider({
		provider: "qwen",
		apiKey: "test-key",
	});
	const config = provider.getConfig();
	assert.equal(
		config.baseUrl,
		"https://dashscope.aliyuncs.com/compatible-mode/v1",
	);
});

test("QwenProvider uses custom baseUrl", () => {
	const provider = new QwenProvider({
		provider: "qwen",
		apiKey: "test-key",
		baseUrl: "https://custom.qwen.ai/v1",
	});
	const config = provider.getConfig();
	assert.equal(config.baseUrl, "https://custom.qwen.ai/v1");
});

test("QwenProvider healthCheck returns boolean", async () => {
	const originalFetch = global.fetch;
	global.fetch = async () =>
		({
			ok: true,
			json: async () => ({ data: [] }),
		}) as unknown as Response;

	try {
		const provider = new QwenProvider(TEST_CONFIG);
		const result = await provider.healthCheck();
		assert.equal(typeof result, "boolean");
	} finally {
		global.fetch = originalFetch;
	}
});

test("QwenProvider healthCheck handles failure", async () => {
	const originalFetch = global.fetch;
	global.fetch = async () => {
		throw new Error("Network error");
	};

	try {
		const provider = new QwenProvider(TEST_CONFIG);
		const result = await provider.healthCheck();
		assert.equal(result, false);
	} finally {
		global.fetch = originalFetch;
	}
});
