/**
 * BaseChannel Tests — verifies the abstract base class contract.
 *
 * Tests use a concrete test double (TestChannel) to exercise
 * BaseChannel behavior through its public interface only.
 */

import { equal, ok, strictEqual } from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { BaseChannel, ChannelState } from "../../src/channels/base-channel.js";

// ─── Test Double ─────────────────────────────────────────────────────────────

interface TestConfig {
	endpoint: string;
	timeout?: number;
}

interface TestMessage {
	id: string;
	text: string;
}

class TestChannel extends BaseChannel<TestConfig, TestMessage> {
	private receivedMessages: TestMessage[] = [];
	private emittedErrors: Array<{ message: string; recoverable: boolean }> = [];

	async connect(): Promise<void> {
		this.markConnected();
	}

	async disconnect(): Promise<void> {
		this.markDisconnected();
	}

	// Public accessors for testing protected behavior
	async receiveMessage(msg: TestMessage): Promise<void> {
		await this.dispatchMessage(msg);
	}

	sendTestMessage(): void {
		this.recordSent();
	}

	triggerError(message: string, recoverable = true): void {
		this.emitError(new Error(message), recoverable);
	}

	getReceivedMessages(): TestMessage[] {
		return this.receivedMessages;
	}

	getEmittedErrors(): Array<{ message: string; recoverable: boolean }> {
		return this.emittedErrors;
	}

	// Register internal handler to capture dispatched messages
	setupTestHooks(): void {
		this.messageHandlers.push(async (msg: TestMessage) => {
			this.receivedMessages.push(msg);
		});
		this.onError((event) => {
			this.emittedErrors.push({
				message: event.error.message,
				recoverable: event.recoverable,
			});
		});
	}
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("BaseChannel", () => {
	let channel: TestChannel;

	beforeEach(() => {
		channel = new TestChannel({ endpoint: "http://localhost:9999" });
		channel.setupTestHooks();
	});

	describe("initial state", () => {
		it("starts in idle state", () => {
			strictEqual(channel.getState(), ChannelState.Idle);
		});

		it("is not connected initially", () => {
			equal(channel.isConnected(), false);
		});

		it("has zero message counters", () => {
			const stats = channel.getStats();
			strictEqual(stats.messagesSent, 0);
			strictEqual(stats.messagesReceived, 0);
		});
	});

	describe("config management", () => {
		it("returns a copy of the config", () => {
			const config = channel.getConfig();
			strictEqual(config.endpoint, "http://localhost:9999");
		});

		it("allows partial config updates", () => {
			channel.updateConfig({ timeout: 5000 });
			const config = channel.getConfig();
			strictEqual(config.timeout, 5000);
			strictEqual(config.endpoint, "http://localhost:9999");
		});
	});

	describe("lifecycle", () => {
		it("transitions to connected state after connect", async () => {
			await channel.connect();
			strictEqual(channel.getState(), ChannelState.Connected);
			ok(channel.isConnected());
		});

		it("transitions to disconnected state after disconnect", async () => {
			await channel.connect();
			await channel.disconnect();
			strictEqual(channel.getState(), ChannelState.Disconnected);
			equal(channel.isConnected(), false);
		});
	});

	describe("message handling", () => {
		it("tracks sent messages", () => {
			channel.sendTestMessage();
			const stats = channel.getStats();
			strictEqual(stats.messagesSent, 1);
		});

		it("tracks last activity on send", () => {
			channel.sendTestMessage();
			const stats = channel.getStats();
			ok(stats.lastActivity != null);
			ok(stats.lastActivity > 0);
		});

		it("dispatches messages to registered handlers", async () => {
			await channel.receiveMessage({ id: "1", text: "test" });
			const received = channel.getReceivedMessages();
			strictEqual(received.length, 1);
			strictEqual(received[0].text, "test");
		});

		it("increments received counter on dispatch", async () => {
			await channel.receiveMessage({ id: "1", text: "hello" });
			const stats = channel.getStats();
			strictEqual(stats.messagesReceived, 1);
		});

		it("removes handlers with offMessage", async () => {
			let handlerCalled = false;
			const handler = async (_msg: TestMessage) => {
				handlerCalled = true;
			};
			channel.onMessage(handler);

			await channel.receiveMessage({ id: "2", text: "ping" });
			ok(handlerCalled, "handler was called");

			handlerCalled = false;
			channel.offMessage(handler);

			await channel.receiveMessage({ id: "3", text: "pong" });
			equal(handlerCalled, false, "handler was not called after removal");
		});
	});

	describe("error handling", () => {
		it("emits error events to listeners", () => {
			channel.triggerError("something broke", true);
			const errors = channel.getEmittedErrors();
			strictEqual(errors.length, 1);
			strictEqual(errors[0].message, "something broke");
			ok(errors[0].recoverable);
		});

		it("transitions to error state on non-recoverable error", () => {
			channel.triggerError("fatal", false);
			strictEqual(channel.getState(), ChannelState.Error);
		});

		it("stays connected on recoverable error", async () => {
			await channel.connect();
			channel.triggerError("temporary glitch", true);
			strictEqual(channel.getState(), ChannelState.Connected);
		});
	});

	describe("stats", () => {
		it("reports connected status", async () => {
			await channel.connect();
			const stats = channel.getStats();
			ok(stats.connected);
		});

		it("includes all required fields", () => {
			const stats = channel.getStats();
			ok("connected" in stats);
			ok("messagesSent" in stats);
			ok("messagesReceived" in stats);
		});
	});

	describe("health check", () => {
		it("returns false when not connected", async () => {
			const healthy = await channel.healthCheck();
			equal(healthy, false);
		});

		it("returns true when connected", async () => {
			await channel.connect();
			const healthy = await channel.healthCheck();
			ok(healthy);
		});
	});
});
