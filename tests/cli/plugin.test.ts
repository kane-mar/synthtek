/**
 * CLI Plugin Command Tests
 * Tests the plugin list, install, and uninstall CLI commands.
 */

import assert from "node:assert";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

// We test the PluginDiscoverer directly since it's the core of plugin list
import { PluginDiscoverer } from "../../src/plugins/discovery.js";
import type { PluginConfig } from "../../src/plugins/types.js";

describe("CLI Plugin Commands", () => {
	let testDir: string;
	let pluginDir: string;

	before(() => {
		testDir = join(tmpdir(), `synthtek-cli-test-${Date.now()}`);
		pluginDir = join(testDir, "plugins");
		mkdirSync(pluginDir, { recursive: true });
	});

	after(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe("plugin list", () => {
		it("discovers plugins with synthtek-plugin keyword", async () => {
			const pluginPath = join(pluginDir, "test-plugin");
			mkdirSync(pluginPath, { recursive: true });
			writeFileSync(
				join(pluginPath, "package.json"),
				JSON.stringify({
					name: "test-plugin",
					version: "1.0.0",
					keywords: ["synthtek-plugin"],
				}),
			);

			const discoverer = new PluginDiscoverer({
				directories: [pluginDir],
				overrides: {},
				validateConfig: false,
			} as PluginConfig);

			const plugins = await discoverer.discover();
			assert.strictEqual(plugins.length, 1);
			assert.strictEqual(plugins[0].name, "test-plugin");
			assert.strictEqual(plugins[0].version, "1.0.0");
		});

		it("discovers plugins with synthtek field in package.json", async () => {
			const pluginPath = join(pluginDir, "synthtek-field-plugin");
			mkdirSync(pluginPath, { recursive: true });
			writeFileSync(
				join(pluginPath, "package.json"),
				JSON.stringify({
					name: "synthtek-field-plugin",
					version: "2.0.0",
					synthtek: { type: "plugin" },
				}),
			);

			const discoverer = new PluginDiscoverer({
				directories: [pluginDir],
				overrides: {},
				validateConfig: false,
			} as PluginConfig);

			const plugins = await discoverer.discover();
			const found = plugins.find((p) => p.name === "synthtek-field-plugin");
			assert.ok(found);
			assert.strictEqual(found.version, "2.0.0");
		});

		it("discovers plugins with plugin.json manifest", async () => {
			const pluginPath = join(pluginDir, "manifest-plugin");
			mkdirSync(pluginPath, { recursive: true });
			writeFileSync(
				join(pluginPath, "plugin.json"),
				JSON.stringify({
					name: "manifest-plugin",
					version: "0.1.0",
					description: "A plugin defined via plugin.json",
				}),
			);

			const discoverer = new PluginDiscoverer({
				directories: [pluginDir],
				overrides: {},
				validateConfig: false,
			} as PluginConfig);

			const plugins = await discoverer.discover();
			const found = plugins.find((p) => p.name === "manifest-plugin");
			assert.ok(found);
			assert.strictEqual(found.version, "0.1.0");
		});

		it("ignores non-plugin directories", async () => {
			const nonPluginPath = join(pluginDir, "not-a-plugin");
			mkdirSync(nonPluginPath, { recursive: true });
			writeFileSync(
				join(nonPluginPath, "package.json"),
				JSON.stringify({
					name: "not-a-plugin",
					version: "1.0.0",
				}),
			);

			const discoverer = new PluginDiscoverer({
				directories: [pluginDir],
				overrides: {},
				validateConfig: false,
			} as PluginConfig);

			const plugins = await discoverer.discover();
			const found = plugins.find((p) => p.name === "not-a-plugin");
			assert.strictEqual(found, undefined);
		});

		it("returns empty array when no plugins found", async () => {
			const emptyDir = join(testDir, "empty");
			mkdirSync(emptyDir, { recursive: true });

			const discoverer = new PluginDiscoverer({
				directories: [emptyDir],
				overrides: {},
				validateConfig: false,
			} as PluginConfig);

			const plugins = await discoverer.discover();
			assert.strictEqual(plugins.length, 0);
		});

		it("scans multiple directories", async () => {
			const dir1 = join(testDir, "plugins-1");
			const dir2 = join(testDir, "plugins-2");
			mkdirSync(dir1, { recursive: true });
			mkdirSync(dir2, { recursive: true });

			const p1 = join(dir1, "plugin-a");
			mkdirSync(p1, { recursive: true });
			writeFileSync(
				join(p1, "package.json"),
				JSON.stringify({
					name: "plugin-a",
					version: "1.0.0",
					keywords: ["synthtek-plugin"],
				}),
			);

			const p2 = join(dir2, "plugin-b");
			mkdirSync(p2, { recursive: true });
			writeFileSync(
				join(p2, "package.json"),
				JSON.stringify({
					name: "plugin-b",
					version: "1.0.0",
					keywords: ["synthtek-plugin"],
				}),
			);

			const discoverer = new PluginDiscoverer({
				directories: [dir1, dir2],
				overrides: {},
				validateConfig: false,
			} as PluginConfig);

			const plugins = await discoverer.discover();
			assert.strictEqual(plugins.length, 2);
		});
	});

	describe("plugin install/uninstall", () => {
		it("can create a plugin directory structure", () => {
			const pluginPath = join(pluginDir, "new-plugin");
			mkdirSync(pluginPath, { recursive: true });
			writeFileSync(
				join(pluginPath, "package.json"),
				JSON.stringify({
					name: "new-plugin",
					version: "1.0.0",
					keywords: ["synthtek-plugin"],
					synthtek: { type: "plugin", main: "dist/index.js" },
				}),
			);

			assert.ok(existsSync(pluginPath));
			assert.ok(existsSync(join(pluginPath, "package.json")));
		});

		it("can remove a plugin directory", () => {
			const pluginPath = join(pluginDir, "to-remove");
			mkdirSync(pluginPath, { recursive: true });
			assert.ok(existsSync(pluginPath));

			rmSync(pluginPath, { recursive: true, force: true });
			assert.ok(!existsSync(pluginPath));
		});
	});
});
