/**
 * Tests for ConfigServiceImpl
 */

import { equal, ok } from "node:assert";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { ConfigServiceImpl } from "../src/core/config.js";

const TEST_DIR = join(process.cwd(), "tests", ".tmp-config");

describe("ConfigServiceImpl", () => {
	let config: ConfigServiceImpl;
	let configPath: string;

	before(() => {
		if (!existsSync(TEST_DIR)) {
			mkdirSync(TEST_DIR, { recursive: true });
		}
		configPath = join(TEST_DIR, "test-config.json");
	});

	after(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true, force: true });
		}
	});

	it("returns default values", () => {
		config = new ConfigServiceImpl();
		equal(config.get("name"), "synthtek");
		equal(config.get("version"), "1.0.0");
		equal(config.get("logLevel"), "info");
		equal(config.get("maxExecTimeout"), 60);
	});

	it("sets and gets values", () => {
		config = new ConfigServiceImpl();
		config.set("name", "mybot");
		equal(config.get("name"), "mybot");

		config.set("logLevel", "debug");
		equal(config.get("logLevel"), "debug");
	});

	it("returns a copy of all config", () => {
		config = new ConfigServiceImpl();
		const all = config.getAll();
		equal(all.name, "synthtek");
		ok(typeof all === "object");
	});

	it("loads config from file", async () => {
		config = new ConfigServiceImpl();
		writeFileSync(
			configPath,
			JSON.stringify({ name: "loaded-bot", logLevel: "debug" }),
		);

		await config.load(configPath);

		equal(config.get("name"), "loaded-bot");
		equal(config.get("logLevel"), "debug");
	});

	it("ignores invalid config file", async () => {
		config = new ConfigServiceImpl();
		const invalidPath = join(TEST_DIR, "invalid-config.json");
		writeFileSync(invalidPath, "not valid json {{{");

		await config.load(invalidPath);

		// Should still have defaults
		equal(config.get("name"), "synthtek");
	});

	it("handles missing config file gracefully", async () => {
		config = new ConfigServiceImpl();
		await config.load("/nonexistent/path/config.json");
		// Should not throw
	});
});
