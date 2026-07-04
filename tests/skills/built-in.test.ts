/**
 * Tests for Built-in Skills
 *
 * Covers DuckDuckGo search (real API), TDD test generation,
 * and cron scheduling (in-memory scheduler).
 */

import { ok, strictEqual } from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { BuiltInSkillsRegistry } from "../../src/skills/built-in/registry.js";
import type {
	SkillContext,
	SkillResult,
} from "../../src/skills/built-in/types.js";

/** Await a skill result if it's a Promise */
async function resolveResult(
	result: SkillResult | Promise<SkillResult>,
): Promise<SkillResult> {
	return result instanceof Promise ? result : result;
}

describe("BuiltInSkillsRegistry", () => {
	let registry: BuiltInSkillsRegistry;

	beforeEach(() => {
		registry = new BuiltInSkillsRegistry();
	});

	describe("constructor", () => {
		it("creates registry with built-in skills", () => {
			ok(registry, "registry created");
		});

		it("does not include removed memory skills", () => {
			strictEqual(registry.getSkill("memory-reflect"), null);
			strictEqual(registry.getSkill("memory-defrag"), null);
			strictEqual(registry.getSkill("memory-notes"), null);
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

		it("includes cron-list helper skill", () => {
			const skill = registry.getSkill("cron-list");
			ok(skill, "cron-list skill exists");
		});
	});

	describe("duckduckgo search skill", () => {
		it("requires a query", async () => {
			const skill = registry.getSkill("duckduckgo-search");
			ok(skill, "skill exists");

			const result = await resolveResult(skill.execute({} as SkillContext));
			strictEqual(result.success, false);
			ok(result.error, "returns error when query is missing");
		});

		it("returns search results for a valid query", {
			timeout: 10_000,
		}, async () => {
			const skill = registry.getSkill("duckduckgo-search");
			ok(skill, "skill exists");

			const result = await resolveResult(
				skill.execute({
					query: "test",
					options: { limit: 3 },
				} as SkillContext),
			);
			ok(result, "result returned");
			ok(result.success, "search succeeded");
			ok(Array.isArray(result.data), "returns array of results");
			const results = result.data as Array<{
				title: string;
				url: string;
				snippet: string;
			}>;
			ok(results.length <= 3, "respects limit");
			if (results.length > 0) {
				ok(results[0].title, "result has title");
				ok(results[0].url, "result has url");
			}
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
			ok(!(result instanceof Promise), "sync result");
			if (!(result instanceof Promise)) {
				ok(typeof result.data === "string", "returns test code");
				ok((result.data as string).includes("test"), "contains test");
				ok((result.data as string).includes("add"), "references function");
			}
		});

		it("requires function name", () => {
			const skill = registry.getSkill("tdd");
			ok(skill, "skill exists");

			const result = skill.execute({} as SkillContext);
			ok(!(result instanceof Promise), "sync result");
			if (!(result instanceof Promise)) {
				strictEqual(result.success, false);
				ok(result.error, "returns error when function name is missing");
			}
		});
	});

	describe("cron skill", () => {
		it("schedules a reminder", () => {
			const skill = registry.getSkill("cron");
			ok(skill, "skill exists");

			const result = skill.execute({
				message: "Test reminder",
				at: "30 9 * * *",
			} as SkillContext);
			ok(!(result instanceof Promise), "sync result");
			if (!(result instanceof Promise)) {
				ok(result, "result returned");
				ok(result.success, "reminder scheduled");
				const data = result.data as Record<string, unknown>;
				ok(data.id, "has job id");
				strictEqual(data.scheduled, true);
			}
		});

		it("rejects invalid cron expressions", () => {
			const skill = registry.getSkill("cron");
			ok(skill, "skill exists");

			const result = skill.execute({
				message: "bad cron",
				at: "not-a-cron",
			} as SkillContext);
			ok(!(result instanceof Promise), "sync result");
			if (!(result instanceof Promise)) {
				strictEqual(result.success, false);
				ok(result.error, "returns error for invalid expression");
			}
		});

		it("requires a message", () => {
			const skill = registry.getSkill("cron");
			ok(skill, "skill exists");

			const result = skill.execute({
				at: "0 9 * * *",
			} as SkillContext);
			ok(!(result instanceof Promise), "sync result");
			if (!(result instanceof Promise)) {
				strictEqual(result.success, false);
				ok(result.error, "returns error when message is missing");
			}
		});

		it("parses valid cron expression", () => {
			const skill = registry.getSkill("cron");
			ok(skill, "skill exists");

			const parsed = skill.parseCronExpression?.("30 9 * * *");
			ok(parsed, "expression parsed");
			strictEqual(parsed.hour, 9);
			strictEqual(parsed.minute, 30);
		});

		it("rejects invalid minute in cron expression", () => {
			const skill = registry.getSkill("cron");
			ok(skill, "skill exists");

			const parsed = skill.parseCronExpression?.("60 9 * * *");
			strictEqual(parsed, null, "invalid minute rejected");
		});

		it("rejects invalid hour in cron expression", () => {
			const skill = registry.getSkill("cron");
			ok(skill, "skill exists");

			const parsed = skill.parseCronExpression?.("0 24 * * *");
			strictEqual(parsed, null, "invalid hour rejected");
		});

		it("accepts wildcard minute", () => {
			const skill = registry.getSkill("cron");
			ok(skill, "skill exists");

			const parsed = skill.parseCronExpression?.("* 9 * * *");
			ok(parsed, "wildcard minute accepted");
			strictEqual(parsed.minute, -1);
		});
	});

	describe("cron-list skill", () => {
		it("lists scheduled cron jobs", () => {
			const skill = registry.getSkill("cron-list");
			ok(skill, "skill exists");

			const result = skill.execute({} as SkillContext);
			ok(!(result instanceof Promise), "sync result");
			if (!(result instanceof Promise)) {
				ok(result, "result returned");
				ok(result.success, "listing succeeded");
				const data = result.data as { jobs: unknown[]; count: number };
				ok(Array.isArray(data.jobs), "returns jobs array");
				ok(typeof data.count === "number", "has count");
			}
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

		it("returns false for unavailable skills", () => {
			strictEqual(registry.isAvailable("memory-reflect"), false);
		});
	});
});
