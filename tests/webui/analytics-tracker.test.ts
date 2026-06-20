/**
 * Tests for WebUI Analytics Tracker
 */

import { ok, strictEqual } from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { AnalyticsTracker } from "../../src/webui/analytics.js";

describe("AnalyticsTracker", () => {
	let tracker: AnalyticsTracker;

	beforeEach(() => {
		tracker = new AnalyticsTracker();
	});

	describe("constructor", () => {
		it("creates an empty tracker", () => {
			ok(tracker, "tracker created");
			const summary = tracker.getSummary();
			strictEqual(summary.requestVolume.total, 0);
			strictEqual(summary.tokenUsage.total, 0);
		});
	});

	describe("trackRequest", () => {
		it("records a successful request", () => {
			tracker.trackRequest({
				provider: "openai",
				model: "gpt-4o",
				promptTokens: 100,
				completionTokens: 50,
				latencyMs: 1200,
				cost: 0.002,
				success: true,
			});
			const summary = tracker.getSummary();
			strictEqual(summary.requestVolume.total, 1);
			strictEqual(summary.tokenUsage.total, 150);
			strictEqual(summary.tokenUsage.promptTokens, 100);
			strictEqual(summary.tokenUsage.completionTokens, 50);
		});

		it("records a failed request", () => {
			tracker.trackRequest({
				provider: "anthropic",
				model: "claude-3",
				promptTokens: 0,
				completionTokens: 0,
				latencyMs: 5000,
				cost: 0,
				success: false,
				errorMessage: "Rate limit exceeded",
			});
			const summary = tracker.getSummary();
			strictEqual(summary.requestVolume.total, 1);
			strictEqual(summary.errors.total, 1);
			strictEqual(summary.errors.rate, 1);
		});

		it("tracks latency stats", () => {
			tracker.trackRequest({
				provider: "openai",
				model: "gpt-4o",
				promptTokens: 50,
				completionTokens: 30,
				latencyMs: 500,
				cost: 0.001,
				success: true,
			});
			tracker.trackRequest({
				provider: "openai",
				model: "gpt-4o",
				promptTokens: 100,
				completionTokens: 60,
				latencyMs: 1500,
				cost: 0.003,
				success: true,
			});
			const summary = tracker.getSummary();
			strictEqual(summary.latency.average, 1000);
			strictEqual(summary.latency.min, 500);
			strictEqual(summary.latency.max, 1500);
			strictEqual(summary.latency.recentRequests, 2);
		});

		it("accumulates provider costs", () => {
			tracker.trackRequest({
				provider: "openai",
				model: "gpt-4o",
				promptTokens: 100,
				completionTokens: 50,
				latencyMs: 800,
				cost: 0.002,
				success: true,
			});
			tracker.trackRequest({
				provider: "anthropic",
				model: "claude-3",
				promptTokens: 200,
				completionTokens: 100,
				latencyMs: 1500,
				cost: 0.006,
				success: true,
			});
			tracker.trackRequest({
				provider: "openai",
				model: "gpt-4o",
				promptTokens: 50,
				completionTokens: 25,
				latencyMs: 600,
				cost: 0.001,
				success: true,
			});
			const summary = tracker.getSummary();
			strictEqual(summary.providerCosts.total, 0.009);
			strictEqual(summary.providerCosts.byProvider.openai, 0.003);
			strictEqual(summary.providerCosts.byProvider.anthropic, 0.006);
		});
	});

	describe("trackError", () => {
		it("records errors by type", () => {
			tracker.trackError({
				type: "api",
				source: "web",
				message: "404 Not Found",
			});
			tracker.trackError({
				type: "provider",
				source: "openai",
				message: "Timeout",
			});
			tracker.trackError({
				type: "provider",
				source: "anthropic",
				message: "Rate limited",
			});
			const summary = tracker.getSummary();
			strictEqual(summary.errors.total, 3);
			strictEqual(summary.errors.byType.api, 1);
			strictEqual(summary.errors.byType.provider, 2);
		});
	});

	describe("trackChannelUsage", () => {
		it("accumulates channel message counts", () => {
			tracker.trackChannelUsage("telegram", 10, 5);
			tracker.trackChannelUsage("discord", 3, 8);
			tracker.trackChannelUsage("telegram", 2, 1);
			const summary = tracker.getSummary();
			strictEqual(summary.channelUsage.totalMessages, 29);
			strictEqual(summary.channelUsage.byChannel.telegram.sent, 12);
			strictEqual(summary.channelUsage.byChannel.telegram.received, 6);
			strictEqual(summary.channelUsage.byChannel.discord.sent, 3);
			strictEqual(summary.channelUsage.byChannel.discord.received, 8);
		});
	});

	describe("getSummary", () => {
		it("includes request volume by endpoint", () => {
			tracker.trackRequest({
				provider: "openai",
				model: "gpt-4o",
				promptTokens: 10,
				completionTokens: 5,
				latencyMs: 300,
				cost: 0.0001,
				endpoint: "/api/chat/completions",
				success: true,
			});
			tracker.trackRequest({
				provider: "openai",
				model: "gpt-4o",
				promptTokens: 20,
				completionTokens: 10,
				latencyMs: 400,
				cost: 0.0002,
				endpoint: "/api/chat/completions",
				success: true,
			});
			tracker.trackRequest({
				provider: "anthropic",
				model: "claude-3",
				promptTokens: 5,
				completionTokens: 3,
				latencyMs: 200,
				cost: 0.0001,
				endpoint: "/api/chat/completions",
				success: true,
			});
			const summary = tracker.getSummary();
			strictEqual(summary.requestVolume.total, 3);
			strictEqual(summary.requestVolume.byEndpoint["/api/chat/completions"], 3);
		});

		it("includes session activity", () => {
			// Simulate some session activity before computing summary
			const summary = tracker.getSummary();
			strictEqual(summary.sessionActivity.totalSessions, 0);
		});
	});
});
