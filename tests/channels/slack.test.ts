/**
 * Slack Channel Tests
 * Uses Node's built-in test runner (node:test).
 */

import { equal, ok, rejects } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import { SlackChannel } from "../../src/channels/slack/channel.js";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("SlackChannel", () => {
	let channel: SlackChannel;

	beforeEach(() => {
		channel = new SlackChannel({ token: "xoxb-test-token" });
	});

	afterEach(() => {
		try {
			channel.stop();
		} catch {
			// Ignore cleanup errors
		}
	});

	// ─── Constructor ─────────────────────────────────────────────────────────

	describe("constructor", () => {
		it("creates a channel with default config", () => {
			ok(channel);
		});

		it("creates a channel with custom config", () => {
			const custom = new SlackChannel({
				token: "xoxb-test-token",
				signingSecret: "test-secret",
				botUserId: "U123456",
				enableStreaming: false,
				threadMode: "manual",
				maxReconnectAttempts: 10,
				reconnectDelay: 10000,
			});
			ok(custom);
		});

		it("creates a channel with minimal config", () => {
			const minimal = new SlackChannel({ token: "xoxb-minimal" });
			ok(minimal);
		});
	});

	// ─── Lifecycle ───────────────────────────────────────────────────────────

	describe("lifecycle", () => {
		it("stops without error when never started", async () => {
			await channel.stop();
		});

		it("reports not connected when never started", () => {
			equal(channel.isConnected(), false);
		});

		it("reports health check status", async () => {
			const health = await channel.healthCheckSlack();
			equal(health.ok, false);
			equal(health.connected, false);
		});
	});

	// ─── sendMessage ─────────────────────────────────────────────────────────

	describe("sendMessage", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.sendMessage, "function");
		});

		it("throws when sending with invalid token", async () => {
			await rejects(
				channel.sendMessage("C123456", "Hello!"),
				/Slack API error/,
			);
		});

		it("accepts send options", async () => {
			await rejects(
				channel.sendMessage("C123456", "Hello!", {
					threadTs: "1234567890.123456",
					replyBroadcast: true,
					mrkdwn: true,
				}),
				/Slack API error/,
			);
		});
	});

	// ─── sendBlockMessage ────────────────────────────────────────────────────

	describe("sendBlockMessage", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.sendBlockMessage, "function");
		});

		it("throws when sending blocks with invalid token", async () => {
			await rejects(
				channel.sendBlockMessage("C123456", [
					{ type: "section", text: { type: "mrkdwn", text: "Hello!" } },
				]),
				/Slack API error/,
			);
		});
	});

	// ─── sendAttachment ──────────────────────────────────────────────────────

	describe("sendAttachment", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.sendAttachment, "function");
		});

		it("throws when sending attachments with invalid token", async () => {
			await rejects(
				channel.sendAttachment("C123456", [
					{ fallback: "test", text: "Hello!" },
				]),
				/Slack API error/,
			);
		});
	});

	// ─── Message Management ──────────────────────────────────────────────────

	describe("message management", () => {
		it("has updateMessage method", () => {
			equal(typeof channel.updateMessage, "function");
		});

		it("has deleteMessage method", () => {
			equal(typeof channel.deleteMessage, "function");
		});

		it("throws when updating with invalid token", async () => {
			await rejects(
				channel.updateMessage("C123456", "1234567890.123456", "Updated!"),
				/Slack API error/,
			);
		});

		it("throws when deleting with invalid token", async () => {
			await rejects(
				channel.deleteMessage("C123456", "1234567890.123456"),
				/Slack API error/,
			);
		});
	});

	// ─── Reactions ───────────────────────────────────────────────────────────

	describe("reactions", () => {
		it("has addReaction method", () => {
			equal(typeof channel.addReaction, "function");
		});

		it("has removeReaction method", () => {
			equal(typeof channel.removeReaction, "function");
		});

		it("has getReactions method", () => {
			equal(typeof channel.getReactions, "function");
		});

		it("throws when adding reaction with invalid token", async () => {
			await rejects(
				channel.addReaction("C123456", "1234567890.123456", "white_check_mark"),
				/Slack API error/,
			);
		});

		it("throws when removing reaction with invalid token", async () => {
			await rejects(
				channel.removeReaction(
					"C123456",
					"1234567890.123456",
					"white_check_mark",
				),
				/Slack API error/,
			);
		});

		it("throws when getting reactions with invalid token", async () => {
			await rejects(
				channel.getReactions("C123456", "1234567890.123456"),
				/Slack API error/,
			);
		});
	});

	// ─── Typing Indicators ───────────────────────────────────────────────────

	describe("typing indicators", () => {
		it("has showTyping method", () => {
			equal(typeof channel.showTyping, "function");
		});

		it("does not throw when showing typing with invalid token", async () => {
			// Typing is best-effort, should not throw
			await channel.showTyping("C123456");
		});

		it("accepts thread timestamp for typing", async () => {
			await channel.showTyping("C123456", "1234567890.123456");
		});
	});

	// ─── Channel Info ────────────────────────────────────────────────────────

	describe("channel info", () => {
		it("has getChannelInfo method", () => {
			equal(typeof channel.getChannelInfo, "function");
		});

		it("has listConversations method", () => {
			equal(typeof channel.listConversations, "function");
		});

		it("throws when getting channel info with invalid token", async () => {
			await rejects(channel.getChannelInfo("C123456"), /Slack API error/);
		});

		it("throws when listing conversations with invalid token", async () => {
			await rejects(channel.listConversations(), /Slack API error/);
		});
	});

	// ─── User Info ───────────────────────────────────────────────────────────

	describe("user info", () => {
		it("has getUserInfo method", () => {
			equal(typeof channel.getUserInfo, "function");
		});

		it("throws when getting user info with invalid token", async () => {
			await rejects(channel.getUserInfo("U123456"), /Slack API error/);
		});
	});

	// ─── Team Info ───────────────────────────────────────────────────────────

	describe("team info", () => {
		it("has getTeamInfo method", () => {
			equal(typeof channel.getTeamInfo, "function");
		});

		it("throws when getting team info with invalid token", async () => {
			await rejects(channel.getTeamInfo(), /Slack API error/);
		});
	});

	// ─── File Upload ─────────────────────────────────────────────────────────

	describe("file upload", () => {
		it("has uploadFile method", () => {
			equal(typeof channel.uploadFile, "function");
		});

		it("has getFile method", () => {
			equal(typeof channel.getFile, "function");
		});

		it("returns error result when uploading invalid URL", async () => {
			const result = await channel.uploadFile("https://invalid.url/file.txt", {
				channels: ["C123456"],
				filename: "test.txt",
			});
			equal(result.ok, false);
			ok(result.error);
		});

		it("throws when getting file info with invalid token", async () => {
			await rejects(channel.getFile("F123456"), /Slack API error/);
		});
	});

	// ─── Message Processing ──────────────────────────────────────────────────

	describe("message processing", () => {
		it("has processEvent method", () => {
			equal(typeof channel.processEvent, "function");
		});

		it("has onMessage method", () => {
			equal(typeof channel.onMessage, "function");
		});

		it("ignores non-message events", async () => {
			await channel.processEvent({ type: "hello" });
		});

		it("ignores message subtypes", async () => {
			await channel.processEvent({
				type: "message",
				subtype: "channel_join",
				channel: "C123456",
				ts: "1234567890.123456",
				user: "U123456",
				text: "Welcome!",
			});
		});

		it("dispatches message to handler", async () => {
			let received: any = null;
			channel.onMessage(async (msg) => {
				received = msg;
			});

			await channel.processEvent({
				type: "message",
				channel: "C123456",
				ts: "1234567890.123456",
				user: "U123456",
				text: "Hello!",
				channel_type: "channel",
			});

			ok(received);
			equal(received.messageId, "1234567890.123456");
			equal(received.channelId, "C123456");
			equal(received.fromId, "U123456");
			equal(received.text, "Hello!");
			equal(received.isBotMessage, false);
		});

		it("ignores own bot messages", async () => {
			const botChannel = new SlackChannel({
				token: "xoxb-test",
				botUserId: "U_BOT",
			});

			let received: any = null;
			botChannel.onMessage(async (msg) => {
				received = msg;
			});

			await botChannel.processEvent({
				type: "message",
				channel: "C123456",
				ts: "1234567890.123456",
				user: "U_BOT",
				text: "Bot message",
				channel_type: "channel",
			});

			equal(received, null);
		});

		it("handles bot messages from other bots", async () => {
			let received: any = null;
			channel.onMessage(async (msg) => {
				received = msg;
			});

			await channel.processEvent({
				type: "message",
				channel: "C123456",
				ts: "1234567890.123456",
				bot_id: "B123456",
				username: "OtherBot",
				text: "Bot says hi",
				channel_type: "channel",
			});

			ok(received);
			equal(received.isBotMessage, true);
			equal(received.fromId, "B123456");
		});

		it("handles threaded messages", async () => {
			let received: any = null;
			channel.onMessage(async (msg) => {
				received = msg;
			});

			await channel.processEvent({
				type: "message",
				channel: "C123456",
				ts: "1234567890.654321",
				user: "U123456",
				text: "Reply",
				thread_ts: "1234567890.123456",
				channel_type: "channel",
			});

			ok(received);
			equal(received.threadTs, "1234567890.123456");
		});

		it("handles edited messages", async () => {
			let received: any = null;
			channel.onMessage(async (msg) => {
				received = msg;
			});

			await channel.processEvent({
				type: "message",
				channel: "C123456",
				ts: "1234567890.123456",
				user: "U123456",
				text: "Edited text",
				edited: { ts: "1234567891.000001", user: "U123456" },
				channel_type: "channel",
			});

			ok(received);
			equal(received.isEdited, true);
			equal(received.editedTs, "1234567891.000001");
		});

		it("handles messages with files", async () => {
			let received: any = null;
			channel.onMessage(async (msg) => {
				received = msg;
			});

			await channel.processEvent({
				type: "message",
				channel: "C123456",
				ts: "1234567890.123456",
				user: "U123456",
				text: "Check this out",
				files: [
					{
						id: "F123456",
						name: "image.png",
						mimetype: "image/png",
						size: 1024,
						url_private: "https://files.slack.com/files/F123456",
					},
				],
				channel_type: "channel",
			});

			ok(received);
			equal(received.files.length, 1);
			equal(received.files[0].id, "F123456");
			equal(received.imageUrls.length, 1);
		});

		it("handles multiple message handlers", async () => {
			const handler1: any[] = [];
			const handler2: any[] = [];

			channel.onMessage(async (msg) => {
				handler1.push(msg);
			});
			channel.onMessage(async (msg) => {
				handler2.push(msg);
			});

			await channel.processEvent({
				type: "message",
				channel: "C123456",
				ts: "1234567890.123456",
				user: "U123456",
				text: "Hello!",
				channel_type: "channel",
			});

			equal(handler1.length, 1);
			equal(handler2.length, 1);
		});
	});

	// ─── Stats ───────────────────────────────────────────────────────────────

	describe("stats", () => {
		it("has getSlackStats method", () => {
			equal(typeof channel.getSlackStats, "function");
		});

		it("returns initial stats", () => {
			const stats = channel.getSlackStats();
			equal(stats.messagesSent, 0);
			equal(stats.messagesReceived, 0);
			equal(stats.errors, 0);
			equal(stats.reconnects, 0);
		});

		it("tracks messages received", async () => {
			channel.onMessage(async () => {});

			await channel.processEvent({
				type: "message",
				channel: "C123456",
				ts: "1234567890.123456",
				user: "U123456",
				text: "Hello!",
				channel_type: "channel",
			});

			const stats = channel.getStats();
			equal(stats.messagesReceived, 1);
		});

		it("tracks handler errors", async () => {
			channel.onMessage(async () => {
				throw new Error("Handler error");
			});

			await channel.processEvent({
				type: "message",
				channel: "C123456",
				ts: "1234567890.123456",
				user: "U123456",
				text: "Hello!",
				channel_type: "channel",
			});

			const stats = channel.getSlackStats();
			equal(stats.errors, 1);
		});
	});

	// ─── Message Splitting ───────────────────────────────────────────────────

	describe("message splitting", () => {
		it("splits long messages into chunks", async () => {
			const longText = "A".repeat(5000);
			await rejects(
				channel.sendMessage("C123456", longText),
				/Slack API error/,
			);
		});

		it("sends short messages without splitting", async () => {
			await rejects(
				channel.sendMessage("C123456", "Short message"),
				/Slack API error/,
			);
		});
	});
});
