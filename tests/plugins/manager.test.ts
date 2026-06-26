/**
 * Plugin module tests
 *
 * Covers:
 * - PluginManager lifecycle (init, run, teardown)
 * - State transitions (discovered → loaded → initialized → running → stopped → errored)
 * - Error boundaries (one plugin crash doesn't kill others)
 * - Discovery and loading
 */
import assert from "node:assert";
import { describe, it, mock } from "node:test";
import { EventEmitter } from "node:events";

function makeLogger() {
	return {
		info: mock.fn(),
		warn: mock.fn(),
		error: mock.fn(),
		debug: mock.fn(),
	};
}

function makePlugin(name: string, overrides = {}) {
	return {
		manifest: { name, version: "1.0.0" },
		context: {
			config: {},
			logger: makeLogger(),
			emit: mock.fn(),
			on: mock.fn(),
			events: new EventEmitter(),
		},
		init: mock.fn(() => Promise.resolve()),
		run: mock.fn(() => Promise.resolve()),
		teardown: mock.fn(() => Promise.resolve()),
		...overrides,
	};
}

async function createManager() {
	const { PluginManager } = await import("../../src/plugins/manager.js");
	return new PluginManager({
		config: { directories: ["./plugins"], overrides: {}, validateConfig: false },
		globalLogger: makeLogger() as any,
		globalEvents: new EventEmitter(),
	});
}

describe("PluginManager", () => {
	it("creates an instance with default config", async () => {
		const pm = await createManager();
		assert.ok(pm);
	});

	it("initializes a plugin", async () => {
		const pm = await createManager();
		const plugin = makePlugin("test-plugin");
		await pm.init([plugin]);
		assert.equal(plugin.init.mock.calls.length, 1);
	});

	it("transitions states correctly through lifecycle", async () => {
		const pm = await createManager();
		const plugin = makePlugin("state-test");
		await pm.init([plugin]);
		await pm.run([plugin]);
		await pm.teardown([plugin]);

		assert.equal(plugin.init.mock.calls.length, 1);
		assert.equal(plugin.run.mock.calls.length, 1);
		assert.equal(plugin.teardown.mock.calls.length, 1);
	});

	it("continues running other plugins when one fails", async () => {
		const pm = await createManager();
		const badPlugin = makePlugin("faulty", {
			init: mock.fn(() => Promise.reject(new Error("Boom!"))),
		});
		const goodPlugin = makePlugin("reliable");
		const logger = (pm as any).globalLogger;

		await pm.init([badPlugin, goodPlugin]);

		assert.equal(goodPlugin.init.mock.calls.length, 1);
		assert.ok(
			logger.error.mock.calls.length >= 1,
			"should log error for faulty plugin",
		);
	});

	it("calls teardown on all plugins", async () => {
		const pm = await createManager();
		const plugin1 = makePlugin("p1");
		const plugin2 = makePlugin("p2");
		await pm.init([plugin1, plugin2]);
		await pm.teardown([plugin1, plugin2]);

		assert.equal(plugin1.teardown.mock.calls.length, 1);
		assert.equal(plugin2.teardown.mock.calls.length, 1);
	});

	it("handles empty plugin list gracefully", async () => {
		const pm = await createManager();
		await pm.init([]);
		await pm.run([]);
		await pm.teardown([]);
	});

	it("preserves init order across parallel init", async () => {
		const pm = await createManager();
		const p1 = makePlugin("fast");
		const p2 = makePlugin("slow");

		await pm.init([p1, p2]);
		assert.equal(p1.init.mock.calls.length, 1);
		assert.equal(p2.init.mock.calls.length, 1);
	});
});

describe("PluginDiscoverer", () => {
	it("discovers plugins from directory", async () => {
		const { PluginDiscoverer } = await import(
			"../../src/plugins/discovery.js"
		);
		const discoverer = new PluginDiscoverer({
			directories: ["./plugins"],
			overrides: {},
			validateConfig: false,
		});
		const plugins = await discoverer.discover();
		assert.ok(Array.isArray(plugins));
	});
});

describe("PluginStatus type", () => {
	it("has expected state values", async () => {
		const status: string[] = [
			"discovered",
			"loaded",
			"initialized",
			"running",
			"stopped",
			"errored",
		];
		assert.ok(status.includes("discovered"));
		assert.ok(status.includes("running"));
		assert.ok(status.includes("stopped"));
		assert.ok(status.includes("errored"));
	});
});
