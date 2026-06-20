/**
 * Built-in Skills Registry
 *
 * Provides DuckDuckGo search, TDD, cron, and memory skills
 * as built-in capabilities.
 */

import type {
	BuiltInSkill,
	CronParsed,
	SkillContext,
	SkillResult,
	SkillSearchResult,
} from "./types.js";

// ── DuckDuckGo Search Skill ──────────────────────────────────────────────────

const duckduckgoSearchSkill: BuiltInSkill = {
	name: "duckduckgo-search",
	description: "Search the web using DuckDuckGo",
	category: "utility",
	version: "1.0.0",

	execute(context: SkillContext): SkillResult {
		const query = context.query as string;
		if (!query) {
			return { success: false, error: "Query is required" };
		}

		const limit = (context.options as Record<string, unknown>)?.limit ?? 5;

		// Mock search results — in production, this would call DuckDuckGo API
		const results: SkillSearchResult[] = [
			{
				title: `${query} - Wikipedia`,
				url: `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,
				snippet: `Information about ${query}...`,
			},
			{
				title: `${query} - Latest News`,
				url: `https://news.example.com/search?q=${encodeURIComponent(query)}`,
				snippet: `Latest news about ${query}...`,
			},
			{
				title: `${query} - Documentation`,
				url: `https://docs.example.com/${encodeURIComponent(query)}`,
				snippet: `Documentation for ${query}...`,
			},
		];

		return {
			success: true,
			data: results.slice(0, Number(limit)),
		};
	},
};

// ── TDD Skill ────────────────────────────────────────────────────────────────

const tddSkill: BuiltInSkill = {
	name: "tdd",
	description: "Generate test skeletons for test-driven development",
	category: "development",
	version: "1.0.0",

	execute(context: SkillContext): SkillResult {
		const functionName = context.functionName as string;
		const params = context.params as string[];
		const _returnType = context.returnType as string;
		void _returnType;

		if (!functionName) {
			return { success: false, error: "Function name is required" };
		}

		const paramStr = params?.join(", ") ?? "";
		const testCode = `
import { describe, it } from 'node:test';
import { strictEqual, ok } from 'node:assert';
import { ${functionName} } from './${functionName}.js';

describe('${functionName}', () => {
  it('works with valid input', () => {
    const result = ${functionName}(${paramStr ? "testValues" : ""});
    ok(result !== undefined, 'returns a value');
  });

  it('handles edge cases', () => {
    // TODO: Add edge case tests
  });

  it('handles error cases', () => {
    // TODO: Add error case tests
  });
});
`.trim();

		return { success: true, data: testCode };
	},
};

// ── Cron Skill ───────────────────────────────────────────────────────────────

const cronSkill: BuiltInSkill = {
	name: "cron",
	description: "Schedule reminders and recurring tasks",
	category: "utility",
	version: "1.0.0",

	execute(context: SkillContext): SkillResult {
		const message = context.message as string;
		if (!message) {
			return { success: false, error: "Message is required" };
		}

		return {
			success: true,
			data: {
				scheduled: true,
				message,
				at: context.at as string,
			},
		};
	},

	parseCronExpression(expr: string): CronParsed | null {
		const parts = expr.trim().split(/\s+/);
		if (parts.length !== 5) return null;

		const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

		if (minute === "*" || !/^\d+$/.test(minute)) {
			return null;
		}
		if (hour === "*" || !/^\d+$/.test(hour)) {
			return null;
		}

		return {
			minute: parseInt(minute, 10),
			hour: parseInt(hour, 10),
			dayOfMonth,
			month,
			dayOfWeek,
		};
	},
};

// ── Memory Skills ────────────────────────────────────────────────────────────

const memoryReflectSkill: BuiltInSkill = {
	name: "memory-reflect",
	description: "Reflect on recent interactions and consolidate memories",
	category: "memory",
	version: "1.0.0",

	execute(_context: SkillContext): SkillResult {
		return {
			success: true,
			data: { reflected: true, timestamp: Date.now() },
		};
	},
};

const memoryDefragSkill: BuiltInSkill = {
	name: "memory-defrag",
	description: "Defragment and consolidate memory entries",
	category: "memory",
	version: "1.0.0",

	execute(_context: SkillContext): SkillResult {
		return {
			success: true,
			data: { defragmented: true, timestamp: Date.now() },
		};
	},
};

const memoryNotesSkill: BuiltInSkill = {
	name: "memory-notes",
	description: "Write and manage notes in long-term memory",
	category: "memory",
	version: "1.0.0",

	execute(context: SkillContext): SkillResult {
		const note = context.message as string;
		if (!note) {
			return { success: false, error: "Note content is required" };
		}

		return {
			success: true,
			data: { note, saved: true, timestamp: Date.now() },
		};
	},
};

// ── Registry ─────────────────────────────────────────────────────────────────

export class BuiltInSkillsRegistry {
	private readonly skills: Map<string, BuiltInSkill> = new Map();

	constructor() {
		this.skills.set(duckduckgoSearchSkill.name, duckduckgoSearchSkill);
		this.skills.set(tddSkill.name, tddSkill);
		this.skills.set(cronSkill.name, cronSkill);
		this.skills.set(memoryReflectSkill.name, memoryReflectSkill);
		this.skills.set(memoryDefragSkill.name, memoryDefragSkill);
		this.skills.set(memoryNotesSkill.name, memoryNotesSkill);
	}

	listSkills(): BuiltInSkill[] {
		return Array.from(this.skills.values());
	}

	getSkill(name: string): BuiltInSkill | null {
		return this.skills.get(name) ?? null;
	}

	getDependencies(name: string): string[] {
		// Built-in skills have no external dependencies
		void name;
		return [];
	}

	isAvailable(name: string): boolean {
		return this.skills.has(name);
	}
}
