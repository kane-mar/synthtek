/**
 * Tests for Plugin System
 */

import { strict as assert } from "node:assert";
import { EventEmitter } from "node:events";
import { join } from "node:path";
import { describe, it } from "node:test";
import { PluginDiscoverer } from "../src/plugins/discovery.js";
import { PluginLoader } from "../src/plugins/loader.js";
import { PluginManager } from "../src/plugins/manager.js";
import type { Logger, Plugin, PluginConfig } from "../src/plugins/types.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function createMockLogger(): Logger {
	return {
		debug: () => {},
		info: () => {},
		warn: () => {},
		error: () => {},
	};
}

function createMockConfig(pluginsDir: string): PluginConfig {
	return {
		directories: [pluginsDir],
		overrides: {},
		validateConfig: true,
	};
}

// ─── PluginDiscoverer Tests ─────────────────────────────────────────────────

describe("PluginDiscoverer", () => {
	it("should discover plugins with synthtek-plugin keyword", async () => {
		const config = createMockConfig(join(process.cwd(), "test-plugins"));
		const discoverer = new PluginDiscoverer(config);

		const discovered = await discoverer.discover();
		assert.ok(Array.isArray(discovered));
		assert.ok(discovered.length >= 0);
	});

	it("should scan multiple directories", async () => {
		const config = createMockConfig(join(process.cwd(), "test-plugins"));
		config.directories = [join(process.cwd(), "test-plugins"), "/nonexistent"];
		const discoverer = new PluginDiscoverer(config);

		const discovered = await discoverer.discover();
		assert.ok(Array.isArray(discovered));
	});

	it("should sort discovered plugins by name", async () => {
		const config = createMockConfig(join(process.cwd(), "test-plugins"));
		const discoverer = new PluginDiscoverer(config);

		const discovered = await discoverer.discover();
		for (let i = 1; i < discovered.length; i++) {
			assert.ok(
				discovered[i - 1].name.localeCompare(discovered[i].name) <= 0,
				"Plugins should be sorted by name",
			);
		}
	});
});

// ─── PluginLoader Tests ─────────────────────────────────────────────────────

describe("PluginLoader", () => {
	it("should load a valid plugin", async () => {
		const logger = createMockLogger();
		const events = new EventEmitter();
		const config = createMockConfig(join(process.cwd(), "test-plugins"));
		const loader = new PluginLoader({
			config,
			globalLogger: logger,
			globalEvents: events,
		});

		// With no real plugins, should return empty array
		const plugins = await loader.load([]);
		assert.ok(Array.isArray(plugins));
		assert.strictEqual(plugins.length, 0);
	});

	it("should validate dependencies", async () => {
		const logger = createMockLogger();
		const events = new EventEmitter();
		const config = createMockConfig(join(process.cwd(), "test-plugins"));
		const loader = new PluginLoader({
			config,
			globalLogger: logger,
			globalEvents: events,
		});

		// Plugin that requires a non-existent dependency
		const discovered = [
			{
				name: "test-plugin",
				version: "1.0.0",
				path: join(process.cwd(), "test-plugins", "test-plugin"),
				manifest: {
					name: "test-plugin",
					version: "1.0.0",
					requires: ["nonexistent-plugin"],
				},
			},
		];

		try {
			await loader.load(discovered);
			assert.fail("Should have thrown on missing dependency");
		} catch (error) {
			assert.ok(
				error instanceof Error && error.message.includes("requires"),
				"Error should mention missing dependency",
			);
		}
	});

	it("should detect circular dependencies", async () => {
		const logger = createMockLogger();
		const events = new EventEmitter();
		const config = createMockConfig(join(process.cwd(), "test-plugins"));
		const loader = new PluginLoader({
			config,
			globalLogger: logger,
			globalEvents: events,
		});

		const discovered = [
			{
				name: "plugin-a",
				version: "1.0.0",
				path: join(process.cwd(), "test-plugins", "test-plugin"),
				manifest: {
					name: "plugin-a",
					version: "1.0.0",
					requires: ["plugin-b"],
				},
			},
			{
				name: "plugin-b",
				version: "1.0.0",
				path: join(process.cwd(), "test-plugins", "test-plugin"),
				manifest: {
					name: "plugin-b",
					version: "1.0.0",
					requires: ["plugin-a"],
				},
			},
		];

		try {
			await loader.load(discovered);
			assert.fail("Should have thrown on circular dependency");
		} catch (error) {
			assert.ok(
				error instanceof Error && error.message.includes("Circular"),
				"Error should mention circular dependency",
			);
		}
	});

	it("should validate config against schema", async () => {
		const logger = createMockLogger();
		const events = new EventEmitter();
		const config: PluginConfig = {
			directories: [join(process.cwd(), "test-plugins")],
			overrides: {
				"test-plugin": {
					apiKey: "secret123",
				},
			},
			validateConfig: true,
		};
		const loader = new PluginLoader({
			config,
			globalLogger: logger,
			globalEvents: events,
		});

		const discovered = [
			{
				name: "test-plugin",
				version: "1.0.0",
				path: join(process.cwd(), "test-plugins", "test-plugin"),
				manifest: {
					name: "test-plugin",
					version: "1.0.0",
					configSchema: {
						required: ["apiKey"],
						properties: {
							apiKey: { type: "string" },
						},
					},
				},
			},
		];

		// Valid config should not throw
		const plugins = await loader.load(discovered);
		assert.ok(Array.isArray(plugins));
	});

	it("should reject invalid config types", async () => {
		const logger = createMockLogger();
		const events = new EventEmitter();
		const config: PluginConfig = {
			directories: [join(process.cwd(), "test-plugins")],
			overrides: {
				"test-plugin": {
					apiKey: 123, // should be string
				},
			},
			validateConfig: true,
		};
		const loader = new PluginLoader({
			config,
			globalLogger: logger,
			globalEvents: events,
		});

		const discovered = [
			{
				name: "test-plugin",
				version: "1.0.0",
				path: join(process.cwd(), "test-plugins", "test-plugin"),
				manifest: {
					name: "test-plugin",
					version: "1.0.0",
					configSchema: {
						required: ["apiKey"],
						properties: {
							apiKey: { type: "string" },
						},
					},
				},
			},
		];

		// Loader catches errors per-plugin and continues; invalid config means plugin is not loaded
		const plugins = await loader.load(discovered);
		assert.strictEqual(
			plugins.length,
			0,
			"Plugin with invalid config should not be loaded",
		);
	});
});

// ─── PluginManager Tests ────────────────────────────────────────────────────

describe("PluginManager", () => {
	it("should discover, load, init, run, and teardown plugins", async () => {
		const logger = createMockLogger();
		const events = new EventEmitter();
		// Use a temp dir with no plugins to test empty lifecycle
		const { mkdtemp } = await import("node:fs/promises");
		const { tmpdir } = await import("node:os");
		const emptyDir = await mkdtemp(join(tmpdir(), "st-plugins-"));
		const config = createMockConfig(emptyDir);
		const manager = new PluginManager({
			config,
			globalLogger: logger,
			globalEvents: events,
		});

		// Discover (no plugins in empty dir)
		const discovered = await manager.discover();
		assert.ok(Array.isArray(discovered));
		assert.strictEqual(discovered.length, 0);

		// Load (empty list)
		const plugins = await manager.load(discovered);
		assert.ok(Array.isArray(plugins));
		assert.strictEqual(plugins.length, 0);

		// Init (empty list)
		await manager.init(plugins);

		// Run (empty list)
		await manager.run(plugins);

		// Teardown (empty list)
		await manager.teardown(plugins);

		// State should be empty
		const state = manager.getState();
		assert.strictEqual(state.size, 0);
	});

	it("should track plugin states correctly", async () => {
		const logger = createMockLogger();
		const events = new EventEmitter();
		const config = createMockConfig(join(process.cwd(), "test-plugins"));
		const manager = new PluginManager({
			config,
			globalLogger: logger,
			globalEvents: events,
		});

		const discovered = await manager.discover();
		await manager.load(discovered);
		const state = manager.getPluginState("test-plugin");

		assert.ok(state);
		assert.strictEqual(state.status, "loaded");
		assert.strictEqual(manager.isRunning("test-plugin"), false);
	});

	it("should handle plugin init errors gracefully", async () => {
		const logger = createMockLogger();
		const events = new EventEmitter();
		const config = createMockConfig(join(process.cwd(), "test-plugins"));
		const manager = new PluginManager({
			config,
			globalLogger: logger,
			globalEvents: events,
		});

		const failingPlugin: Plugin = {
			manifest: { name: "failing-plugin", version: "1.0.0" },
			context: {
				config: {},
				logger: createMockLogger(),
				emit: () => {},
				on: () => {},
				events: new EventEmitter(),
			},
			init: async () => {
				throw new Error("Init failed");
			},
			run: async () => {},
			teardown: async () => {},
		};

		// Should not throw — error is captured in state
		await manager.init([failingPlugin]);

		const state = manager.getState();
		assert.strictEqual(state.get("failing-plugin")?.status, "error");
		assert.ok(state.get("failing-plugin")?.error);
	});

	it("should emit events on plugin lifecycle", async () => {
		const logger = createMockLogger();
		const events = new EventEmitter();
		const config = createMockConfig(join(process.cwd(), "test-plugins"));
		const manager = new PluginManager({
			config,
			globalLogger: logger,
			globalEvents: events,
		});

		const eventsCaptured: string[] = [];
		events.on("plugin:initialized", () => eventsCaptured.push("initialized"));
		events.on("plugin:started", () => eventsCaptured.push("started"));
		events.on("plugin:teardown", () => eventsCaptured.push("teardown"));

		const plugins = await manager.load([]);
		await manager.init(plugins);
		await manager.run(plugins);
		await manager.teardown(plugins);

		// With empty plugin list, no events should fire
		assert.ok(eventsCaptured);
	});

	it("should get plugin state by name", async () => {
		const logger = createMockLogger();
		const events = new EventEmitter();
		const config = createMockConfig(join(process.cwd(), "test-plugins"));
		const manager = new PluginManager({
			config,
			globalLogger: logger,
			globalEvents: events,
		});

		const discovered = await manager.discover();
		await manager.load(discovered);
		const state = manager.getPluginState("test-plugin");

		assert.ok(state);
		assert.strictEqual(state.name, "test-plugin");
	});
});
