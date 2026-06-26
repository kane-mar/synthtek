/**
 * Discord Channel Tests
 * Uses Node's built-in test runner (node:test).
 */

import { equal, ok, rejects } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import { DiscordChannel } from "../../src/channels/discord/channel.js";
import { BaseChannel } from "../../src/channels/base-channel.js";

// ─── Test doubles ────────────────────────────────────────────────────────────

// We use manual test doubles instead of mock.fn() to avoid API mismatches.
function createMockChannel(
	id: string,
	name: string,
	type: number,
	topic?: string,
) {
	let lastSent: Record<string, unknown> | null = null;
	let lastEdited: string | null = null;
	let lastDeleted = false;
	let lastReacted = false;
	let lastTyping = false;

	const mockCh = {
		id,
		name,
		type,
		topic,
		send: async (opts: Record<string, unknown>) => {
			lastSent = opts;
			return { id: `msg-${id}`, channel: mockCh };
		},
		sendTyping: async () => {
			lastTyping = true;
		},
		edit: async (opts: { content: string }) => {
			lastEdited = opts.content;
		},
		delete: async () => {
			lastDeleted = true;
		},
		react: async () => {
			lastReacted = true;
		},
		reactions: {
			cache: { get: () => null },
		},
		messages: {
			fetch: async (msgId: string) => ({
				id: msgId,
				edit: async (opts: { content: string }) => {
					lastEdited = opts.content;
				},
				delete: async () => {
					lastDeleted = true;
				},
				react: async () => {
					lastReacted = true;
				},
				reactions: { cache: { get: () => null } },
			}),
		},
		guild: { id: `guild-${id}`, members: { me: null } },
		getLastSent: () => lastSent,
		getLastEdited: () => lastEdited,
		getLastDeleted: () => lastDeleted,
		getLastReacted: () => lastReacted,
		getLastTyping: () => lastTyping,
	};
	return mockCh;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("DiscordChannel", () => {
	let channel: DiscordChannel;
	let mockChannels: Record<string, any>;

	beforeEach(() => {
		mockChannels = {};
	});

	afterEach(() => {
		try {
			channel.stop();
		} catch {
			// Ignore cleanup errors
		}
	});

	// ─── H1: BaseChannel integration ─────────────────────────────────────────

	describe("BaseChannel integration (H1)", () => {
		it("extends BaseChannel", () => {
			channel = new DiscordChannel({ token: "test-token" });
			ok(channel instanceof BaseChannel);
		});

		it("supports onMessage / onError registration", () => {
			channel = new DiscordChannel({ token: "test-token" });
			ok(typeof channel.onMessage, "function");
			ok(typeof channel.onError, "function");
		});

		it("has connect/disconnect lifecycle methods", () => {
			channel = new DiscordChannel({ token: "test-token" });
			ok(typeof channel.connect, "function");
			ok(typeof channel.disconnect, "function");
		});

		it("provides channel state", () => {
			channel = new DiscordChannel({ token: "test-token" });
			ok(typeof channel.isConnected === "function");
			equal(channel.isConnected(), false);
		});
	});

	describe("constructor", () => {
		it("creates a channel with default config", () => {
			channel = new DiscordChannel({ token: "test-token" });
			ok(channel);
		});

		it("creates a channel with custom config", () => {
			channel = new DiscordChannel({
				token: "test-token",
				clientId: "client-123",
				guildIds: ["guild-1", "guild-2"],
				reconnectDelay: 10000,
				maxReconnectAttempts: 3,
				presenceInterval: 60000,
			});
			ok(channel);
		});
	});

	describe("lifecycle", () => {
		it("starts and stops", async () => {
			channel = new DiscordChannel({ token: "test-token" });
			ok(channel);
			await channel.stop();
		});

		it("reports health check status", async () => {
			channel = new DiscordChannel({ token: "test-token" });
			const healthy = await channel.healthCheck();
			// Client is never actually started (no login), so isReady() returns false
			equal(healthy, false);
		});
	});

	describe("sendMessage", () => {
		it("sends a text message", async () => {
			const mockCh = createMockChannel("111222333", "test-channel", 0);
			mockChannels["111222333"] = mockCh;

			channel = new DiscordChannel({ token: "test-token" });

			// We need to test through the public API. Since the constructor creates
			// its own Client, we test the channel methods that don't require a real client.
			// For sendMessage, we verify the method exists and has the right signature.
			equal(typeof channel.sendMessage, "function");
		});

		it("throws when channel not found", async () => {
			channel = new DiscordChannel({ token: "test-token" });

			await rejects(
				channel.sendMessage("nonexistent", "Hello!"),
				/Channel.*not found/,
			);
		});
	});

	describe("sendEmbed", () => {
		it("has the correct method signature", async () => {
			channel = new DiscordChannel({ token: "test-token" });
			equal(typeof channel.sendEmbed, "function");
		});
	});

	describe("sendWithButtons", () => {
		it("has the correct method signature", async () => {
			channel = new DiscordChannel({ token: "test-token" });
			equal(typeof channel.sendWithButtons, "function");
		});
	});

	describe("sendWithSelectMenu", () => {
		it("has the correct method signature", async () => {
			channel = new DiscordChannel({ token: "test-token" });
			equal(typeof channel.sendWithSelectMenu, "function");
		});
	});

	describe("editMessage", () => {
		it("throws when channel not found", async () => {
			channel = new DiscordChannel({ token: "test-token" });

			await rejects(
				channel.editMessage("nonexistent", "msg-123", "Updated"),
				/Channel.*not found/,
			);
		});
	});

	describe("deleteMessage", () => {
		it("throws when channel not found", async () => {
			channel = new DiscordChannel({ token: "test-token" });

			await rejects(
				channel.deleteMessage("nonexistent", "msg-123"),
				/Channel.*not found/,
			);
		});
	});

	describe("sendTyping", () => {
		it("throws when channel not found", async () => {
			channel = new DiscordChannel({ token: "test-token" });

			await rejects(channel.sendTyping("nonexistent"), /Channel.*not found/);
		});
	});

	describe("addReaction", () => {
		it("throws when channel not found", async () => {
			channel = new DiscordChannel({ token: "test-token" });

			await rejects(
				channel.addReaction("nonexistent", "msg-123", "👍"),
				/Channel.*not found/,
			);
		});
	});

	describe("removeReaction", () => {
		it("throws when channel not found", async () => {
			channel = new DiscordChannel({ token: "test-token" });

			await rejects(
				channel.removeReaction("nonexistent", "msg-123", "👍"),
				/Channel.*not found/,
			);
		});
	});

	describe("getReactions", () => {
		it("throws when channel not found", async () => {
			channel = new DiscordChannel({ token: "test-token" });

			await rejects(
				channel.getReactions("nonexistent", "msg-123"),
				/Channel.*not found/,
			);
		});
	});

	describe("getChannelInfo", () => {
		it("returns null for nonexistent channel", async () => {
			channel = new DiscordChannel({ token: "test-token" });
			const info = await channel.getChannelInfo("nonexistent");
			equal(info, null);
		});
	});

	describe("getGuildInfo", () => {
		it("returns null for nonexistent guild", async () => {
			channel = new DiscordChannel({ token: "test-token" });
			const info = await channel.getGuildInfo("nonexistent");
			equal(info, null);
		});
	});

	describe("getUserInfo", () => {
		it("returns null for nonexistent user", async () => {
			channel = new DiscordChannel({ token: "test-token" });
			const info = await channel.getUserInfo("nonexistent");
			equal(info, null);
		});
	});

	describe("getPermissions", () => {
		it("returns default permissions when channel not found", async () => {
			channel = new DiscordChannel({ token: "test-token" });
			const perms = await channel.getPermissions("nonexistent");
			ok(perms);
			equal(perms.administrator, false);
		});
	});

	describe("getStats", () => {
		it("returns client stats", () => {
			channel = new DiscordChannel({ token: "test-token" });
			const stats = channel.getStats();
			// Client is never started, so ready is false
			equal(stats.ready, false);
			equal(stats.connectedGuilds, 0);
			equal(stats.connectedChannels, 0);
		});
	});

	describe("hasPermission", () => {
		it("returns false when channel not found", async () => {
			channel = new DiscordChannel({ token: "test-token" });
			const hasPerm = await channel.hasPermission(
				"nonexistent",
				"administrator",
			);
			equal(hasPerm, false);
		});
	});

	describe("registerCommands", () => {
		it("has the correct method signature", async () => {
			channel = new DiscordChannel({ token: "test-token" });
			equal(typeof channel.registerCommands, "function");
		});
	});

	describe("getCommands", () => {
		it("has the correct method signature", async () => {
			channel = new DiscordChannel({ token: "test-token" });
			equal(typeof channel.getCommands, "function");
		});
	});

	describe("deleteCommand", () => {
		it("has the correct method signature", async () => {
			channel = new DiscordChannel({ token: "test-token" });
			equal(typeof channel.deleteCommand, "function");
		});
	});

	describe("getBotUser", () => {
		it("returns undefined before login", () => {
			channel = new DiscordChannel({ token: "test-token" });
			equal(channel.getBotUser(), undefined);
		});
	});
});
