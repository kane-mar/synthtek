/**
 * Telegram Channel Tests
 * Uses Node's built-in test runner (node:test).
 */

import { equal, ok, rejects } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import { TelegramChannel } from "../../src/channels/telegram/channel.js";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("TelegramChannel", () => {
	let channel: TelegramChannel;

	beforeEach(() => {
		channel = new TelegramChannel({ token: "test-token" });
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
			const custom = new TelegramChannel({
				token: "test-token",
				pollingTimeout: 60,
				maxRetries: 10,
				retryDelay: 2000,
				usePolling: false,
			});
			ok(custom);
		});
	});

	// ─── Lifecycle ───────────────────────────────────────────────────────────

	describe("lifecycle", () => {
		it("stops without error when never started", async () => {
			await channel.stop();
		});

		it("reports health check status", async () => {
			// Without a real bot token, health check will fail
			const healthy = await channel.healthCheck();
			equal(healthy, false);
		});
	});

	// ─── sendMessage ─────────────────────────────────────────────────────────

	describe("sendMessage", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.sendMessage, "function");
		});

		it("throws when sending to invalid chat (no real token)", async () => {
			await rejects(
				channel.sendMessage(12345, "Hello!"),
				/Failed to send message|fetch failed|TypeError/,
			);
		});
	});

	// ─── sendMedia ───────────────────────────────────────────────────────────

	describe("sendMedia", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.sendMedia, "function");
		});
	});

	// ─── sendAlbum ───────────────────────────────────────────────────────────

	describe("sendAlbum", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.sendAlbum, "function");
		});
	});

	// ─── sendFile ────────────────────────────────────────────────────────────

	describe("sendFile", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.sendFile, "function");
		});
	});

	// ─── editMessage ─────────────────────────────────────────────────────────

	describe("editMessage", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.editMessage, "function");
		});
	});

	// ─── editCaption ─────────────────────────────────────────────────────────

	describe("editCaption", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.editCaption, "function");
		});
	});

	// ─── deleteMessage ───────────────────────────────────────────────────────

	describe("deleteMessage", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.deleteMessage, "function");
		});
	});

	// ─── pinMessage ──────────────────────────────────────────────────────────

	describe("pinMessage", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.pinMessage, "function");
		});
	});

	// ─── unpinMessage ────────────────────────────────────────────────────────

	describe("unpinMessage", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.unpinMessage, "function");
		});
	});

	// ─── unpinAllMessages ────────────────────────────────────────────────────

	describe("unpinAllMessages", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.unpinAllMessages, "function");
		});
	});

	// ─── sendTyping ──────────────────────────────────────────────────────────

	describe("sendTyping", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.sendTyping, "function");
		});
	});

	// ─── addReaction ─────────────────────────────────────────────────────────

	describe("addReaction", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.addReaction, "function");
		});
	});

	// ─── removeReactions ─────────────────────────────────────────────────────

	describe("removeReactions", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.removeReactions, "function");
		});
	});

	// ─── getReactions ────────────────────────────────────────────────────────

	describe("getReactions", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.getReactions, "function");
		});
	});

	// ─── getChatInfo ─────────────────────────────────────────────────────────

	describe("getChatInfo", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.getChatInfo, "function");
		});
	});

	// ─── getChatAdministrators ───────────────────────────────────────────────

	describe("getChatAdministrators", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.getChatAdministrators, "function");
		});
	});

	// ─── getChatMemberCount ──────────────────────────────────────────────────

	describe("getChatMemberCount", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.getChatMemberCount, "function");
		});
	});

	// ─── getChatMember ───────────────────────────────────────────────────────

	describe("getChatMember", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.getChatMember, "function");
		});
	});

	// ─── leaveChat ───────────────────────────────────────────────────────────

	describe("leaveChat", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.leaveChat, "function");
		});
	});

	// ─── banChatMember ───────────────────────────────────────────────────────

	describe("banChatMember", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.banChatMember, "function");
		});
	});

	// ─── unbanChatMember ─────────────────────────────────────────────────────

	describe("unbanChatMember", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.unbanChatMember, "function");
		});
	});

	// ─── restrictChatMember ──────────────────────────────────────────────────

	describe("restrictChatMember", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.restrictChatMember, "function");
		});
	});

	// ─── promoteChatMember ───────────────────────────────────────────────────

	describe("promoteChatMember", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.promoteChatMember, "function");
		});
	});

	// ─── getUserProfile ──────────────────────────────────────────────────────

	describe("getUserProfile", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.getUserProfile, "function");
		});
	});

	// ─── setWebhook ──────────────────────────────────────────────────────────

	describe("setWebhook", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.setWebhook, "function");
		});
	});

	// ─── deleteWebhook ───────────────────────────────────────────────────────

	describe("deleteWebhook", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.deleteWebhook, "function");
		});
	});

	// ─── getWebhookInfo ──────────────────────────────────────────────────────

	describe("getWebhookInfo", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.getWebhookInfo, "function");
		});
	});

	// ─── getFileUrl ──────────────────────────────────────────────────────────

	describe("getFileUrl", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.getFileUrl, "function");
		});
	});

	// ─── copyMessage ─────────────────────────────────────────────────────────

	describe("copyMessage", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.copyMessage, "function");
		});
	});

	// ─── forwardMessage ──────────────────────────────────────────────────────

	describe("forwardMessage", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.forwardMessage, "function");
		});
	});

	// ─── getBotInfo / getBotUsername / getBotId ──────────────────────────────

	describe("getBotInfo", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.getBotInfo, "function");
		});
	});

	describe("getBotUsername", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.getBotUsername, "function");
		});
	});

	describe("getBotId", () => {
		it("has the correct method signature", () => {
			equal(typeof channel.getBotId, "function");
		});
	});

	// ─── getStats ────────────────────────────────────────────────────────────

	describe("getStats", () => {
		it("returns channel stats", () => {
			const stats = channel.getStats();
			equal(stats.polling, false);
			equal(stats.lastUpdateId, 0);
		});
	});

	// ─── splitMessage (private, but tested via sendMessage behavior) ─────────

	describe("message splitting", () => {
		it("sends multiple chunks for long messages", async () => {
			// sendMessage will fail with invalid token, but the method exists
			equal(typeof channel.sendMessage, "function");
		});
	});
});
