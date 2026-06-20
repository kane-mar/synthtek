/**
 * Tests for WebSocketChannel (real-time WebSocket communication)
 */

import { ok, strictEqual } from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { WebSocketChannel } from "../../src/channels/websocket/channel.js";
import type { WebSocketChannelConfig } from "../../src/channels/websocket/types.js";

const defaultConfig: WebSocketChannelConfig = {
	port: 8080,
	host: "localhost",
	maxConnections: 100,
	heartbeatIntervalMs: 30000,
	messageTimeoutMs: 30000,
	authRequired: false,
	authToken: "test-token",
};

describe("WebSocketChannel", () => {
	let channel: WebSocketChannel;

	beforeEach(() => {
		channel = new WebSocketChannel(defaultConfig);
	});

	describe("initialization", () => {
		it("creates a channel with config", () => {
			ok(channel, "channel instance created");
			strictEqual(channel.name, "websocket");
		});

		it("creates a channel with auth enabled", () => {
			const authChannel = new WebSocketChannel({
				...defaultConfig,
				authRequired: true,
			});
			ok(authChannel, "channel with auth created");
		});
	});

	describe("connection management", () => {
		it("tracks connected clients", () => {
			const clients = channel.getConnectedClients();
			ok(Array.isArray(clients), "clients is an array");
		});

		it("respects max connections limit", () => {
			strictEqual(channel.maxConnections, defaultConfig.maxConnections);
		});
	});

	describe("message handling", () => {
		it("handles text messages", () => {
			const message = {
				type: "chat",
				content: "Hello",
				sessionId: "test-session",
			};
			ok(channel.canHandleMessage(message), "can handle chat messages");
		});

		it("handles ping/pong", () => {
			const ping = { type: "ping" };
			ok(channel.canHandleMessage(ping), "can handle ping messages");
		});

		it("rejects unknown message types", () => {
			const unknown = { type: "unknown_type" };
			ok(!channel.canHandleMessage(unknown), "unknown type rejected");
		});
	});

	describe("session management", () => {
		it("creates a new session", () => {
			const session = channel.createSession();
			ok(session, "session created");
			ok(session.id, "session has id");
		});

		it("gets an existing session", () => {
			const session = channel.createSession();
			const found = channel.getSession(session.id);
			ok(found, "session found");
			strictEqual(found.id, session.id);
		});

		it("removes a session", () => {
			const session = channel.createSession();
			channel.removeSession(session.id);
			const found = channel.getSession(session.id);
			ok(!found, "session removed");
		});
	});

	describe("authentication", () => {
		it("validates auth token", () => {
			const authChannel = new WebSocketChannel({
				...defaultConfig,
				authRequired: true,
			});

			ok(authChannel.validateToken("test-token"), "valid token accepted");
			ok(!authChannel.validateToken("wrong-token"), "invalid token rejected");
		});

		it("skips auth when disabled", () => {
			ok(channel.validateToken(""), "no auth required");
		});
	});

	describe("broadcast", () => {
		it("broadcasts to all connected clients", () => {
			// Broadcast should not throw even with no clients
			channel.broadcast({ type: "system", content: "test" });
			ok(true, "broadcast succeeded");
		});
	});

	describe("heartbeat", () => {
		it("configures heartbeat interval", () => {
			strictEqual(
				channel.heartbeatIntervalMs,
				defaultConfig.heartbeatIntervalMs,
			);
		});
	});
});
