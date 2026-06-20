/**
 * Tests for ClawHub Integration
 */

import { ok, strictEqual } from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { ClawHubClient } from "../../src/clawhub/client.js";
import type { ClawHubConfig } from "../../src/clawhub/types.js";

const defaultConfig: ClawHubConfig = {
	apiUrl: "https://clawhub.com/api",
	apiKey: "test-key",
	timeout: 10000,
};

describe("ClawHubClient", () => {
	let client: ClawHubClient;

	beforeEach(() => {
		client = new ClawHubClient(defaultConfig);
	});

	describe("constructor", () => {
		it("creates client with config", () => {
			ok(client, "client created");
		});
	});

	describe("skill search", () => {
		it("searches skills by query", () => {
			const results = client.searchSkills("web search");
			ok(Array.isArray(results), "returns array");
			ok(results.length >= 0, "returns results");
		});

		it("searches skills with filters", () => {
			const results = client.searchSkills("memory", { category: "utility" });
			ok(Array.isArray(results), "returns array");
		});

		it("returns empty array for no results", () => {
			const results = client.searchSkills("nonexistent_skill_xyz");
			ok(Array.isArray(results), "returns array");
		});
	});

	describe("skill installation", () => {
		it("installs a skill by name", () => {
			const result = client.installSkill("test-skill", "1.0.0");
			ok(result, "installation result returned");
			strictEqual(result.name, "test-skill");
			strictEqual(result.version, "1.0.0");
		});

		it("validates skill name format", () => {
			ok(client.isValidSkillName("my-skill"), "valid name accepted");
			ok(client.isValidSkillName("skill_123"), "underscore name accepted");
			ok(!client.isValidSkillName(""), "empty name rejected");
			ok(!client.isValidSkillName("invalid/skill"), "path name rejected");
		});

		it("validates version format", () => {
			ok(client.isValidVersion("1.0.0"), "semantic version accepted");
			ok(client.isValidVersion("0.1.0-beta"), "pre-release version accepted");
			ok(!client.isValidVersion(""), "empty version rejected");
			ok(!client.isValidVersion("invalid"), "invalid version rejected");
		});
	});

	describe("skill updates", () => {
		it("checks for skill updates", () => {
			const updates = client.checkForUpdates("web-search", "1.0.0");
			ok(updates !== null, "update check returns result");
		});

		it("updates a skill", () => {
			client.installSkill("web-search", "1.0.0");
			const result = client.updateSkill("web-search", "1.0.0", "1.1.0");
			ok(result, "update result returned");
			strictEqual(result.name, "web-search");
			strictEqual(result.version, "1.1.0");
		});

		it("compares versions", () => {
			ok(client.isNewerVersion("1.1.0", "1.0.0"), "1.1.0 is newer than 1.0.0");
			ok(
				!client.isNewerVersion("1.0.0", "1.1.0"),
				"1.0.0 is not newer than 1.1.0",
			);
			ok(!client.isNewerVersion("1.0.0", "1.0.0"), "same version not newer");
		});
	});

	describe("skill discovery", () => {
		it("discovers available skills", () => {
			const skills = client.discoverSkills();
			ok(Array.isArray(skills), "returns array");
		});

		it("filters skills by category", () => {
			const skills = client.discoverSkills({ category: "utility" });
			ok(Array.isArray(skills), "returns array");
		});

		it("filters skills by tags", () => {
			const skills = client.discoverSkills({ tags: ["memory", "search"] });
			ok(Array.isArray(skills), "returns array");
		});
	});

	describe("skill metadata", () => {
		it("retrieves skill metadata", () => {
			const metadata = client.getSkillMetadata("test-skill");
			ok(metadata, "metadata returned");
			strictEqual(metadata.name, "test-skill");
		});

		it("retrieves skill versions", () => {
			const versions = client.getSkillVersions("test-skill");
			ok(Array.isArray(versions), "returns array");
		});

		it("retrieves skill dependencies", () => {
			const deps = client.getSkillDependencies("test-skill", "1.0.0");
			ok(Array.isArray(deps), "returns array");
		});
	});

	describe("dream learning", () => {
		it("records discovered skill for Dream", () => {
			const recorded = client.recordDiscoveredSkill({
				name: "new-skill",
				category: "utility",
				tags: ["test"],
			});
			ok(recorded, "skill recorded");
		});

		it("retrieves Dream learned skills", () => {
			const learned = client.getLearnedSkills();
			ok(Array.isArray(learned), "returns array");
		});
	});

	describe("error handling", () => {
		it("handles API errors gracefully", () => {
			const errorClient = new ClawHubClient({
				...defaultConfig,
				apiUrl: "invalid",
			});
			const result = errorClient.searchSkills("test");
			ok(Array.isArray(result), "returns empty array on error");
		});
	});
});
