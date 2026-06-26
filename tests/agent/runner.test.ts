/**
 * AgentRunner tests
 */

import assert from "node:assert";
import { describe, it } from "node:test";
import { AgentRunner, type AgentRunnerConfig } from "../../src/agent/runner.js";

function makeConfig(overrides?: Partial<AgentRunnerConfig>): AgentRunnerConfig {
	return {
		provider: "openai",
		apiKey: "test-key",
		baseUrl: "https://api.openai.com/v1",
		model: "gpt-4",
		logLevel: "error",
		...overrides,
	};
}

describe("AgentRunner", () => {
	it("creates an instance with default config", () => {
		const config = makeConfig();
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with custom system prompt", () => {
		const config = makeConfig({ systemPrompt: "You are a coding assistant." });
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with fallback providers", () => {
		const config = makeConfig({
			useFallback: true,
			fallbackProviders: [
				{ provider: "openai", apiKey: "key1" },
				{ provider: "anthropic", apiKey: "key2" },
			],
		});
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with telegram token (legacy)", () => {
		const config = makeConfig({ telegramToken: "123456:ABC-DEF" });
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with telegram webhook (legacy)", () => {
		const config = makeConfig({
			telegramToken: "123456:ABC-DEF",
			telegramWebhookUrl: "https://example.com/webhook",
		});
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with channelConfigs.telegram", () => {
		const config = makeConfig({
			channelConfigs: {
				telegram: {
					token: "123:ABC",
					usePolling: true,
				},
			},
		});
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with channelConfigs.discord", () => {
		const config = makeConfig({
			channelConfigs: {
				discord: {
					token: "bot-token",
				},
			},
		});
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with channelConfigs.slack", () => {
		const config = makeConfig({
			channelConfigs: {
				slack: {
					token: "xoxb-test",
				},
			},
		});
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with channelConfigs.wechat", () => {
		const config = makeConfig({
			channelConfigs: {
				wechat: {
					appId: "wx-test",
					appSecret: "secret",
					token: "token",
					encodingAESKey: "aes-key",
				},
			},
		});
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with channelConfigs.wecom", () => {
		const config = makeConfig({
			channelConfigs: {
				wecom: {
					corpId: "corp",
					agentSecret: "secret",
					agentId: 1000001,
				},
			},
		});
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with channelConfigs.feishu", () => {
		const config = makeConfig({
			channelConfigs: {
				feishu: {
					appId: "app",
					appSecret: "secret",
				},
			},
		});
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with channelConfigs.matrix", () => {
		const config = makeConfig({
			channelConfigs: {
				matrix: {
					homeserver: "https://matrix.org",
					userId: "@user:matrix.org",
					accessToken: "token",
				},
			},
		});
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with channelConfigs.qq", () => {
		const config = makeConfig({
			channelConfigs: {
				qq: {
					appId: "app-id",
					token: "token",
					secret: "secret",
				},
			},
		});
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with channelConfigs.dingtalk", () => {
		const config = makeConfig({
			channelConfigs: {
				dingtalk: {
					clientId: "client",
					clientSecret: "secret",
				},
			},
		});
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with channelConfigs.email", () => {
		const config = makeConfig({
			channelConfigs: {
				email: {
					smtpHost: "smtp.example.com",
					smtpPort: 587,
					smtpUser: "user",
					smtpPass: "pass",
					imapHost: "imap.example.com",
					imapPort: 993,
					imapUser: "user",
					imapPass: "pass",
					fromAddress: "bot@example.com",
				},
			},
		});
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with channelConfigs.teams", () => {
		const config = makeConfig({
			channelConfigs: {
				teams: {
					appId: "app",
					appPassword: "pass",
				},
			},
		});
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with channelConfigs.whatsapp", () => {
		const config = makeConfig({
			channelConfigs: {
				whatsapp: {
					phoneNumberId: "phone",
					businessId: "biz",
					accessToken: "token",
				},
			},
		});
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with channelConfigs.websocket", () => {
		const config = makeConfig({
			channelConfigs: {
				websocket: {
					port: 8080,
				},
			},
		});
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with multiple channels", () => {
		const config = makeConfig({
			channelConfigs: {
				telegram: { token: "123:ABC", usePolling: true },
				discord: { token: "bot-token" },
				slack: { token: "xoxb-test" },
			},
		});
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with stream output enabled", () => {
		const config = makeConfig({ streamOutput: true });
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with debug log level", () => {
		const config = makeConfig({ logLevel: "debug" });
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with warn log level", () => {
		const config = makeConfig({ logLevel: "warn" });
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with error log level", () => {
		const config = makeConfig({ logLevel: "error" });
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with ollama provider", () => {
		const config = makeConfig({
			provider: "ollama",
			baseUrl: "http://localhost:11434",
			model: "llama3",
		});
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with lmstudio provider", () => {
		const config = makeConfig({
			provider: "lmstudio",
			baseUrl: "http://localhost:1234",
			model: "local-model",
		});
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with llamacpp provider", () => {
		const config = makeConfig({
			provider: "llamacpp",
			baseUrl: "http://localhost:8080",
			model: "llama.gguf",
		});
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with openrouter provider", () => {
		const config = makeConfig({
			provider: "openrouter",
			apiKey: "or-key",
			model: "openai/gpt-4",
		});
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with anthropic provider", () => {
		const config = makeConfig({
			provider: "anthropic",
			apiKey: "anthropic-key",
			model: "claude-3-opus",
		});
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with custom loop config", () => {
		const config = makeConfig({
			loopConfig: {
				maxToolCalls: 10,
				temperature: 0.7,
				topP: 0.9,
			},
		});
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with minimal config", () => {
		const config = makeConfig({
			provider: "openai",
			apiKey: "test",
		});
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});

	it("creates an instance with all options", () => {
		const config = makeConfig({
			provider: "openai",
			apiKey: "test",
			baseUrl: "https://api.example.com",
			model: "gpt-4-turbo",
			telegramToken: "123:ABC",
			telegramWebhookUrl: "https://example.com/hook",
			systemPrompt: "Custom prompt",
			logLevel: "debug",
			streamOutput: true,
			useFallback: true,
			fallbackProviders: [
				{ provider: "openai", apiKey: "key1" },
				{ provider: "anthropic", apiKey: "key2" },
				{
					provider: "openrouter",
					apiKey: "key3",
					baseUrl: "https://openrouter.ai/api/v1",
				},
			],
		});
		const runner = new AgentRunner(config);
		assert.ok(runner);
	});
});
