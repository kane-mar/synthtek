/**
 * Tests for Built-in Skills
 */

import { ok, strictEqual } from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { BuiltInSkillsRegistry } from "../../src/skills/built-in/registry.js";
import type { SkillContext } from "../../src/skills/built-in/types.js";

describe("BuiltInSkillsRegistry", () => {
	let registry: BuiltInSkillsRegistry;

	beforeEach(() => {
		registry = new BuiltInSkillsRegistry();
	});

	describe("constructor", () => {
		it("creates registry with built-in skills", () => {
			ok(registry, "registry created");
		});
	});

	describe("skill listing", () => {
		it("lists all built-in skills", () => {
			const skills = registry.listSkills();
			ok(Array.isArray(skills), "returns array");
			ok(skills.length > 0, "has built-in skills");
		});

		it("finds skill by name", () => {
			const skills = registry.listSkills();
			const firstSkill = skills[0];
			const found = registry.getSkill(firstSkill.name);
			ok(found, "skill found");
			strictEqual(found.name, firstSkill.name);
		});

		it("returns null for non-existent skill", () => {
			const found = registry.getSkill("nonexistent-skill");
			strictEqual(found, null);
		});
	});

	describe("duckduckgo search skill", () => {
		it("performs web search", () => {
			const skill = registry.getSkill("duckduckgo-search");
			ok(skill, "skill exists");

			const result = skill.execute({ query: "test search" } as SkillContext);
			ok(result, "result returned");
			ok(Array.isArray(result.data), "returns array of results");
		});

		it("respects result limit", () => {
			const skill = registry.getSkill("duckduckgo-search");
			ok(skill, "skill exists");

			const result = skill.execute({
				query: "test search",
				options: { limit: 3 },
			} as SkillContext);
			ok(result, "result returned");
			ok((result.data as unknown[]).length <= 3, "respects limit");
		});
	});

	describe("tdd skill", () => {
		it("generates test skeleton", () => {
			const skill = registry.getSkill("tdd");
			ok(skill, "skill exists");

			const result = skill.execute({
				functionName: "add",
				params: ["a: number", "b: number"],
				returnType: "number",
			} as SkillContext);
			ok(result, "result returned");
			ok(typeof result.data === "string", "returns test code");
			ok((result.data as string).includes("test"), "contains test");
		});
	});

	describe("cron skill", () => {
		it("schedules a reminder", () => {
			const skill = registry.getSkill("cron");
			ok(skill, "skill exists");

			const result = skill.execute({
				message: "Test reminder",
				at: new Date(Date.now() + 3600000).toISOString(),
			} as SkillContext);
			ok(result, "result returned");
			ok(result.success, "reminder scheduled");
		});

		it("parses cron expression", () => {
			const skill = registry.getSkill("cron");
			ok(skill, "skill exists");

			const parsed = skill.parseCronExpression?.("0 9 * * *");
			ok(parsed, "expression parsed");
			strictEqual(parsed.hour, 9);
		});
	});

	describe("memory skills", () => {
		it("has memory-reflect skill", () => {
			const skill = registry.getSkill("memory-reflect");
			ok(skill, "memory-reflect exists");
		});

		it("has memory-defrag skill", () => {
			const skill = registry.getSkill("memory-defrag");
			ok(skill, "memory-defrag exists");
		});

		it("has memory-notes skill", () => {
			const skill = registry.getSkill("memory-notes");
			ok(skill, "memory-notes exists");
		});
	});

	describe("skill execution", () => {
		it("executes skill with context", () => {
			const skill = registry.getSkill("duckduckgo-search");
			ok(skill, "skill exists");

			const result = skill.execute({ query: "synthtek" } as SkillContext);
			ok(result, "result returned");
			ok(result.success !== undefined, "has success flag");
		});

		it("handles skill execution errors gracefully", () => {
			const skill = registry.getSkill("duckduckgo-search");
			ok(skill, "skill exists");

			const result = skill.execute({} as SkillContext);
			ok(result, "result returned even with missing context");
		});
	});

	describe("skill metadata", () => {
		it("provides skill description", () => {
			const skills = registry.listSkills();
			for (const skill of skills) {
				ok(skill.description, `${skill.name} has description`);
				ok(skill.category, `${skill.name} has category`);
			}
		});

		it("provides skill version", () => {
			const skills = registry.listSkills();
			for (const skill of skills) {
				ok(skill.version, `${skill.name} has version`);
			}
		});
	});

	describe("skill dependencies", () => {
		it("resolves skill dependencies", () => {
			const skill = registry.getSkill("duckduckgo-search");
			ok(skill, "skill exists");

			const deps = registry.getDependencies(skill.name);
			ok(Array.isArray(deps), "returns array");
		});

		it("checks if skill is available", () => {
			const skill = registry.getSkill("duckduckgo-search");
			ok(skill, "skill exists");

			const available = registry.isAvailable(skill.name);
			ok(available, "skill is available");
		});
	});
});
