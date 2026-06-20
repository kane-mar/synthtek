/**
 * Multi-Instance and Hot-Reload Tests
 */

import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import {
	type AgentConfig,
	HotReloadManagerImpl,
	InstanceManagerImpl,
	MultiConfigLoaderImpl,
} from "../../src/config/index.js";

// ── Instance Manager Tests ───────────────────────────────────────────────────

describe("InstanceManagerImpl", () => {
	test("adds and retrieves instances", () => {
		const manager = new InstanceManagerImpl();
		const config: AgentConfig = {
			name: "test-agent",
			version: "1.0.0",
			workspace: "/tmp/test",
			logLevel: "info",
			maxExecTimeout: 60,
			maxExecRetries: 3,
			spawnTimeout: 300,
		};

		manager.addInstance("default", config, null);
		const instance = manager.getInstance("default");
		assert.ok(instance);
		assert.equal(instance.name, "test-agent");
	});

	test("lists all instances", () => {
		const manager = new InstanceManagerImpl();
		const config: AgentConfig = {
			name: "test-agent",
			version: "1.0.0",
			workspace: "/tmp/test",
			logLevel: "info",
			maxExecTimeout: 60,
			maxExecRetries: 3,
			spawnTimeout: 300,
		};

		manager.addInstance("default", config, null);
		manager.addInstance("dev", config, null);
		const instances = manager.listInstances();
		assert.equal(instances.length, 2);
		assert.ok(instances.includes("default"));
		assert.ok(instances.includes("dev"));
	});

	test("removes instances", () => {
		const manager = new InstanceManagerImpl();
		const config: AgentConfig = {
			name: "test-agent",
			version: "1.0.0",
			workspace: "/tmp/test",
			logLevel: "info",
			maxExecTimeout: 60,
			maxExecRetries: 3,
			spawnTimeout: 300,
		};

		manager.addInstance("default", config, null);
		manager.addInstance("dev", config, null);
		assert.equal(manager.removeInstance("dev"), true);
		assert.equal(manager.removeInstance("dev"), false); // Already removed
		assert.equal(manager.listInstances().length, 1);
	});

	test("sets default instance", () => {
		const manager = new InstanceManagerImpl();
		const config: AgentConfig = {
			name: "test-agent",
			version: "1.0.0",
			workspace: "/tmp/test",
			logLevel: "info",
			maxExecTimeout: 60,
			maxExecRetries: 3,
			spawnTimeout: 300,
		};

		manager.addInstance("default", config, null);
		manager.addInstance("dev", config, null);
		manager.setDefaultInstance("dev");

		const defaultInstance = manager.getDefaultInstance();
		assert.ok(defaultInstance);
		assert.equal(defaultInstance.name, "test-agent");
	});

	test("auto-sets first instance as default", () => {
		const manager = new InstanceManagerImpl();
		const config: AgentConfig = {
			name: "test-agent",
			version: "1.0.0",
			workspace: "/tmp/test",
			logLevel: "info",
			maxExecTimeout: 60,
			maxExecRetries: 3,
			spawnTimeout: 300,
		};

		manager.addInstance("first", config, null);
		const defaultInstance = manager.getDefaultInstance();
		assert.ok(defaultInstance);
		assert.equal(defaultInstance.name, "test-agent");
	});

	test("returns null for non-existent instance", () => {
		const manager = new InstanceManagerImpl();
		assert.equal(manager.getInstance("non-existent"), null);
	});

	test("returns null default when no instances", () => {
		const manager = new InstanceManagerImpl();
		assert.equal(manager.getDefaultInstance(), null);
	});

	test("updates default when removing current default", () => {
		const manager = new InstanceManagerImpl();
		const config: AgentConfig = {
			name: "test-agent",
			version: "1.0.0",
			workspace: "/tmp/test",
			logLevel: "info",
			maxExecTimeout: 60,
			maxExecRetries: 3,
			spawnTimeout: 300,
		};

		manager.addInstance("first", config, null);
		manager.addInstance("second", config, null);
		manager.setDefaultInstance("first");

		manager.removeInstance("first");
		const defaultInstance = manager.getDefaultInstance();
		assert.ok(defaultInstance);
		assert.equal(defaultInstance.name, "test-agent");
	});
});

// ── Multi-Config Loader Tests ────────────────────────────────────────────────

describe("MultiConfigLoaderImpl", () => {
	test("loads all instances", () => {
		const instanceManager = new InstanceManagerImpl();
		const config: AgentConfig = {
			name: "test-agent",
			version: "1.0.0",
			workspace: "/tmp/test",
			logLevel: "info",
			maxExecTimeout: 60,
			maxExecRetries: 3,
			spawnTimeout: 300,
		};

		instanceManager.addInstance("default", config, null);
		instanceManager.addInstance("dev", config, null);

		const loader = new MultiConfigLoaderImpl(instanceManager);
		const configs = loader.load();

		assert.equal(configs.size, 2);
		assert.ok(configs.has("default"));
		assert.ok(configs.has("dev"));
	});

	test("loads single instance", () => {
		const instanceManager = new InstanceManagerImpl();
		const config: AgentConfig = {
			name: "test-agent",
			version: "1.0.0",
			workspace: "/tmp/test",
			logLevel: "info",
			maxExecTimeout: 60,
			maxExecRetries: 3,
			spawnTimeout: 300,
		};

		instanceManager.addInstance("dev", config, null);

		const loader = new MultiConfigLoaderImpl(instanceManager);
		const loadedConfig = loader.loadInstance("dev");

		assert.ok(loadedConfig);
		assert.equal(loadedConfig.name, "test-agent");
	});

	test("returns null for non-existent instance", () => {
		const instanceManager = new InstanceManagerImpl();
		const loader = new MultiConfigLoaderImpl(instanceManager);
		assert.equal(loader.loadInstance("non-existent"), null);
	});

	test("discovers instances", () => {
		const instanceManager = new InstanceManagerImpl();
		const config: AgentConfig = {
			name: "test-agent",
			version: "1.0.0",
			workspace: "/tmp/test",
			logLevel: "info",
			maxExecTimeout: 60,
			maxExecRetries: 3,
			spawnTimeout: 300,
		};

		instanceManager.addInstance("default", config, null);
		instanceManager.addInstance("dev", config, null);

		const loader = new MultiConfigLoaderImpl(instanceManager);
		const instances = loader.discoverInstances();

		assert.ok(instances.includes("default"));
		assert.ok(instances.includes("dev"));
	});
});

// ── Hot-Reload Manager Tests ─────────────────────────────────────────────────

describe("HotReloadManagerImpl", () => {
	test("starts and stops", () => {
		const manager = new HotReloadManagerImpl();
		assert.equal(manager.isRunning(), false);

		// Start without a real config file — should fall back to polling
		const configLoader = {
			getConfig: () => ({
				name: "test",
				version: "1.0.0",
				workspace: "/tmp",
				logLevel: "info",
				maxExecTimeout: 60,
				maxExecRetries: 3,
				spawnTimeout: 300,
			}),
			reload: () => ({
				name: "test",
				version: "1.0.0",
				workspace: "/tmp",
				logLevel: "info",
				maxExecTimeout: 60,
				maxExecRetries: 3,
				spawnTimeout: 300,
			}),
			getConfigPath: () => null,
		};

		manager.start(configLoader as any, () => {});
		assert.equal(manager.isRunning(), true);
		manager.stop();
		assert.equal(manager.isRunning(), false);
	});

	test("does not start twice", () => {
		const manager = new HotReloadManagerImpl();
		const configLoader = {
			getConfig: () => ({
				name: "test",
				version: "1.0.0",
				workspace: "/tmp",
				logLevel: "info",
				maxExecTimeout: 60,
				maxExecRetries: 3,
				spawnTimeout: 300,
			}),
			reload: () => ({
				name: "test",
				version: "1.0.0",
				workspace: "/tmp",
				logLevel: "info",
				maxExecTimeout: 60,
				maxExecRetries: 3,
				spawnTimeout: 300,
			}),
			getConfigPath: () => null,
		};

		manager.start(configLoader as any, () => {});
		manager.start(configLoader as any, () => {});
		assert.equal(manager.isRunning(), true);
		manager.stop();
	});

	test("stops cleanly", () => {
		const manager = new HotReloadManagerImpl();
		const configLoader = {
			getConfig: () => ({
				name: "test",
				version: "1.0.0",
				workspace: "/tmp",
				logLevel: "info",
				maxExecTimeout: 60,
				maxExecRetries: 3,
				spawnTimeout: 300,
			}),
			reload: () => ({
				name: "test",
				version: "1.0.0",
				workspace: "/tmp",
				logLevel: "info",
				maxExecTimeout: 60,
				maxExecRetries: 3,
				spawnTimeout: 300,
			}),
			getConfigPath: () => null,
		};

		manager.start(configLoader as any, () => {});
		manager.stop();
		manager.stop(); // Should not throw
		assert.equal(manager.isRunning(), false);
	});

	test("uses custom interval", () => {
		const manager = new HotReloadManagerImpl({ interval: 10000 });
		const configLoader = {
			getConfig: () => ({
				name: "test",
				version: "1.0.0",
				workspace: "/tmp",
				logLevel: "info",
				maxExecTimeout: 60,
				maxExecRetries: 3,
				spawnTimeout: 300,
			}),
			reload: () => ({
				name: "test",
				version: "1.0.0",
				workspace: "/tmp",
				logLevel: "info",
				maxExecTimeout: 60,
				maxExecRetries: 3,
				spawnTimeout: 300,
			}),
			getConfigPath: () => null,
		};

		manager.start(configLoader as any, () => {});
		manager.stop();
	});

	test("returns config path", () => {
		const manager = new HotReloadManagerImpl();
		assert.equal(manager.getConfigPath(), null);
	});
});
