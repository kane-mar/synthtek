/**
 * Metrics collector tests
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MetricsCollector } from "../../src/webui/metrics.js";

describe("MetricsCollector", () => {
	it("starts with empty routes", () => {
		const mc = new MetricsCollector();
		const snapshot = mc.getSnapshot();
		assert.equal(snapshot.totalRequests, 0);
		assert.equal(Object.keys(snapshot.routes).length, 0);
	});

	it("records a single request", () => {
		const mc = new MetricsCollector();
		mc.recordRequest("GET", "/api/health", 200, 5);
		const snapshot = mc.getSnapshot();
		assert.equal(snapshot.totalRequests, 1);
		assert.ok(snapshot.routes["GET:/api/health"]);
		assert.equal(snapshot.routes["GET:/api/health"].requests, 1);
		assert.equal(snapshot.routes["GET:/api/health"].successes, 1);
		assert.equal(snapshot.routes["GET:/api/health"].averageLatencyMs, 5);
	});

	it("records multiple requests to the same route", () => {
		const mc = new MetricsCollector();
		mc.recordRequest("GET", "/api/health", 200, 10);
		mc.recordRequest("GET", "/api/health", 200, 20);
		const snapshot = mc.getSnapshot();
		assert.equal(snapshot.routes["GET:/api/health"].requests, 2);
		assert.equal(snapshot.routes["GET:/api/health"].averageLatencyMs, 15);
	});

	it("tracks error status codes", () => {
		const mc = new MetricsCollector();
		mc.recordRequest("GET", "/api/test", 200, 5);
		mc.recordRequest("GET", "/api/test", 404, 3);
		mc.recordRequest("POST", "/api/test", 500, 10);
		const snapshot = mc.getSnapshot();
		assert.equal(snapshot.routes["GET:/api/test"].successes, 1);
		assert.equal(snapshot.routes["GET:/api/test"].clientErrors, 1);
		assert.equal(snapshot.routes["POST:/api/test"].serverErrors, 1);
	});

	it("includes server uptime", () => {
		const mc = new MetricsCollector();
		const snapshot = mc.getSnapshot();
		assert.ok(snapshot.uptime >= 0);
		assert.ok(snapshot.timestamp);
	});

	it("includes memory usage", () => {
		const mc = new MetricsCollector();
		const snapshot = mc.getSnapshot();
		assert.ok(snapshot.memory.rss > 0);
		assert.ok(snapshot.memory.heapTotal > 0);
		assert.ok(snapshot.memory.heapUsed > 0);
	});

	it("resets all metrics", () => {
		const mc = new MetricsCollector();
		mc.recordRequest("GET", "/api/test", 200, 5);
		mc.reset();
		const snapshot = mc.getSnapshot();
		assert.equal(snapshot.totalRequests, 0);
		assert.equal(Object.keys(snapshot.routes).length, 0);
	});

	it("records last request timestamp", () => {
		const mc = new MetricsCollector();
		mc.recordRequest("GET", "/api/test", 200, 5);
		const snapshot = mc.getSnapshot();
		assert.ok(snapshot.routes["GET:/api/test"].lastRequestAt);
		assert.ok(snapshot.routes["GET:/api/test"].lastRequestAt!.includes("T"));
	});
});
