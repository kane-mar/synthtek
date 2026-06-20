/**
 * Tests for WebUI Analytics Component
 */

import { ok, strictEqual } from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { AnalyticsComponent } from "../../src/webui/frontend/dashboard.js";
import type {
	ChannelInfo,
	DashboardMetrics,
	PluginInfo,
} from "../../src/webui/frontend/types.js";

describe("AnalyticsComponent", () => {
	let analytics: AnalyticsComponent;

	beforeEach(() => {
		analytics = new AnalyticsComponent();
	});

	describe("constructor", () => {
		it("creates analytics with empty metrics", () => {
			ok(analytics, "analytics created");
		});

		it("has default zero metrics", () => {
			strictEqual(analytics.metrics.activeSessions, 0);
			strictEqual(analytics.metrics.totalMessages, 0);
		});
	});

	describe("metrics update", () => {
		it("updates metrics from API response", () => {
			const metrics: DashboardMetrics = {
				activeSessions: 5,
				totalMessages: 150,
				uptime: 3600000,
				pluginsLoaded: 3,
				channelsConnected: 2,
				cpuUsage: 25.5,
				memoryUsage: 45.2,
			};
			analytics.updateMetrics(metrics);
			strictEqual(analytics.metrics.activeSessions, 5);
			strictEqual(analytics.metrics.totalMessages, 150);
		});

		it("updates partial metrics", () => {
			analytics.updateMetrics({
				activeSessions: 10,
				totalMessages: 0,
				uptime: 0,
				pluginsLoaded: 0,
				channelsConnected: 0,
				cpuUsage: 0,
				memoryUsage: 0,
			});
			strictEqual(analytics.metrics.activeSessions, 10);
		});
	});

	describe("plugin management", () => {
		it("adds plugin info", () => {
			const plugin: PluginInfo = {
				name: "test-plugin",
				version: "1.0.0",
				enabled: true,
				status: "loaded",
			};
			analytics.addPlugin(plugin);
			strictEqual(analytics.plugins.length, 1);
			strictEqual(analytics.plugins[0].name, "test-plugin");
		});

		it("toggles plugin enabled state", () => {
			analytics.addPlugin({
				name: "test-plugin",
				version: "1.0.0",
				enabled: true,
				status: "loaded",
			});
			analytics.togglePlugin("test-plugin");
			strictEqual(analytics.plugins[0].enabled, false);
		});

		it("returns plugin count", () => {
			analytics.addPlugin({
				name: "p1",
				version: "1.0",
				enabled: true,
				status: "loaded",
			});
			analytics.addPlugin({
				name: "p2",
				version: "1.0",
				enabled: true,
				status: "loaded",
			});
			strictEqual(analytics.getPluginCount(), 2);
		});

		it("returns loaded plugin count", () => {
			analytics.addPlugin({
				name: "p1",
				version: "1.0",
				enabled: true,
				status: "loaded",
			});
			analytics.addPlugin({
				name: "p2",
				version: "1.0",
				enabled: false,
				status: "disabled",
			});
			strictEqual(analytics.getLoadedPluginCount(), 1);
		});
	});

	describe("channel management", () => {
		it("adds channel info", () => {
			const channel: ChannelInfo = {
				name: "telegram",
				status: "connected",
				messagesReceived: 10,
				messagesSent: 5,
			};
			analytics.addChannel(channel);
			strictEqual(analytics.channels.length, 1);
			strictEqual(analytics.channels[0].name, "telegram");
		});

		it("returns connected channel count", () => {
			analytics.addChannel({
				name: "telegram",
				status: "connected",
				messagesReceived: 0,
				messagesSent: 0,
			});
			analytics.addChannel({
				name: "discord",
				status: "disconnected",
				messagesReceived: 0,
				messagesSent: 0,
			});
			strictEqual(analytics.getConnectedChannelCount(), 1);
		});

		it("returns total messages across channels", () => {
			analytics.addChannel({
				name: "telegram",
				status: "connected",
				messagesReceived: 10,
				messagesSent: 5,
			});
			analytics.addChannel({
				name: "discord",
				status: "connected",
				messagesReceived: 3,
				messagesSent: 2,
			});
			strictEqual(analytics.getTotalMessages(), 20);
		});
	});

	describe("uptime formatting", () => {
		it("formats seconds", () => {
			analytics.metrics.uptime = 45000;
			const formatted = analytics.formatUptime();
			ok(formatted.includes("45"), "includes seconds");
		});

		it("formats minutes", () => {
			analytics.metrics.uptime = 3600000;
			const formatted = analytics.formatUptime();
			ok(formatted.includes("1"), "includes hours");
		});

		it("formats hours", () => {
			analytics.metrics.uptime = 7200000;
			const formatted = analytics.formatUptime();
			ok(formatted.includes("2"), "includes hours");
		});

		it("formats days", () => {
			analytics.metrics.uptime = 172800000;
			const formatted = analytics.formatUptime();
			ok(formatted.includes("2"), "includes days");
		});
	});

	describe("render", () => {
		it("renders analytics HTML", () => {
			const html = analytics.render();
			ok(typeof html === "string", "renders string");
			ok(html.includes("Analytics"), "includes title");
		});

		it("renders metrics in HTML", () => {
			analytics.updateMetrics({
				activeSessions: 5,
				totalMessages: 100,
				uptime: 3600000,
				pluginsLoaded: 3,
				channelsConnected: 2,
				cpuUsage: 25,
				memoryUsage: 50,
			});
			const html = analytics.render();
			ok(html.includes("5"), "shows active sessions");
		});

		it("renders plugins list", () => {
			analytics.addPlugin({
				name: "test-plugin",
				version: "1.0",
				enabled: true,
				status: "loaded",
			});
			const html = analytics.render();
			ok(html.includes("test-plugin"), "shows plugin name");
		});

		it("renders channels list", () => {
			analytics.addChannel({
				name: "telegram",
				status: "connected",
				messagesReceived: 0,
				messagesSent: 0,
			});
			const html = analytics.render();
			ok(html.includes("telegram"), "shows channel name");
		});
	});

	describe("health status", () => {
		it("returns healthy when all channels connected", () => {
			analytics.addChannel({
				name: "telegram",
				status: "connected",
				messagesReceived: 0,
				messagesSent: 0,
			});
			ok(analytics.isHealthy(), "system is healthy");
		});

		it("returns unhealthy when channels disconnected", () => {
			analytics.addChannel({
				name: "telegram",
				status: "disconnected",
				messagesReceived: 0,
				messagesSent: 0,
			});
			ok(!analytics.isHealthy(), "system is unhealthy");
		});

		it("returns healthy with no channels", () => {
			ok(analytics.isHealthy(), "empty system is healthy");
		});
	});
});
