/**
 * QQ Channel Tests
 */

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { QQChannel } from "../../src/channels/qq/channel.js";
import type {
	QQConfig,
	QQHealthStatus,
	QQSendOptions,
} from "../../src/channels/qq/types.js";

describe("QQ Channel", () => {
	const testConfig: QQConfig = {
		appId: "test_app_id",
		token: "test_token",
		secret: "test_secret",
		groupMessages: true,
		c2cMessages: true,
		maxRetries: 3,
		retryDelay: 100,
	};

	let channel: QQChannel;

	before(() => {
		channel = new QQChannel(testConfig);
	});

	after(async () => {
		await channel.disconnect();
	});

	describe("constructor", () => {
		it("should create channel with config", () => {
			assert.ok(channel);
		});

		it("should apply defaults", () => {
			const c = new QQChannel({ appId: "id", token: "t", secret: "s" });
			const config = c.getConfig();
			assert.equal(config.groupMessages, true);
			assert.equal(config.c2cMessages, true);
			assert.equal(config.maxRetries, 3);
		});
	});

	describe("getConfig", () => {
		it("should return config", () => {
			const config = channel.getConfig();
			assert.equal(config.appId, "test_app_id");
		});
	});

	describe("updateConfig", () => {
		it("should update config", () => {
			channel.updateConfig({ groupMessages: false });
			assert.equal(channel.getConfig().groupMessages, false);
		});
	});

	describe("isConnected", () => {
		it("should return false initially", () => {
			assert.equal(channel.isConnected(), false);
		});
	});

	describe("connect", () => {
		it("should throw when auth fails", async () => {
			const bad = new QQChannel({
				appId: "invalid",
				token: "t",
				secret: "invalid",
			});
			await assert.rejects(bad.connect());
		});
	});

	describe("disconnect", () => {
		it("should set connected to false", async () => {
			await channel.disconnect();
			assert.equal(channel.isConnected(), false);
		});
	});

	describe("sendMessage", () => {
		it("should throw when not connected", async () => {
			const opts: QQSendOptions = {
				channelId: "test_channel",
				content: "Hello",
			};
			await assert.rejects(channel.sendMessage(opts));
		});
	});

	describe("startWebSocket", () => {
		it("should throw when not connected", async () => {
			await assert.rejects(channel.startWebSocket());
		});
	});

	describe("onMessage", () => {
		it("should register handler", () => {
			channel.onMessage(async (msg) => {
				assert.ok(msg.messageId);
			});
		});
	});

	describe("getHealthStatus", () => {
		it("should return health status", () => {
			const status: QQHealthStatus = channel.getHealthStatus();
			assert.equal(status.connected, false);
			assert.equal(status.wsStatus, "disconnected");
			assert.equal(status.messagesSent, 0);
		});
	});
});
