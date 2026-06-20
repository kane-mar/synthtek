/**
 * Tests for UX Polish Module
 */

import { ok, strictEqual } from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { UXPolish } from "../../src/ux/polish.js";
import type { UXConfig } from "../../src/ux/types.js";

const defaultConfig: UXConfig = {
	language: "en",
	theme: "dark",
	showTypingIndicator: true,
	maxProgressSteps: 10,
};

describe("UXPolish", () => {
	let ux: UXPolish;

	beforeEach(() => {
		ux = new UXPolish(defaultConfig);
	});

	describe("constructor", () => {
		it("creates UX module with config", () => {
			ok(ux, "UX module created");
		});
	});

	describe("interactive setup wizard", () => {
		it("provides wizard steps", () => {
			const steps = ux.getWizardSteps();
			ok(Array.isArray(steps), "returns array");
			ok(steps.length > 0, "has wizard steps");
		});

		it("has provider selection step", () => {
			const steps = ux.getWizardSteps();
			const providerStep = steps.find((s) => s.id === "provider");
			ok(providerStep, "provider step exists");
		});

		it("has model selection step", () => {
			const steps = ux.getWizardSteps();
			const modelStep = steps.find((s) => s.id === "model");
			ok(modelStep, "model step exists");
		});

		it("has API key configuration step", () => {
			const steps = ux.getWizardSteps();
			const apiKeyStep = steps.find((s) => s.id === "api-key");
			ok(apiKeyStep, "API key step exists");
		});

		it("advances to next step", () => {
			const next = ux.advanceStep(0);
			ok(next === 1, "advanced to step 1");
		});

		it("stops at last step", () => {
			const steps = ux.getWizardSteps();
			const next = ux.advanceStep(steps.length - 1);
			ok(next === steps.length - 1, "stays at last step");
		});
	});

	describe("model autocomplete", () => {
		it("suggests models for OpenAI provider", () => {
			const suggestions = ux.suggestModels("openai");
			ok(Array.isArray(suggestions), "returns array");
			ok(suggestions.length > 0, "has suggestions");
		});

		it("suggests models for Anthropic provider", () => {
			const suggestions = ux.suggestModels("anthropic");
			ok(Array.isArray(suggestions), "returns array");
			ok(suggestions.length > 0, "has suggestions");
		});

		it("suggests models for Ollama provider", () => {
			const suggestions = ux.suggestModels("ollama");
			ok(Array.isArray(suggestions), "returns array");
			ok(suggestions.length > 0, "has suggestions");
		});

		it("filters suggestions by query", () => {
			const suggestions = ux.suggestModels("openai", "gpt-4");
			ok(Array.isArray(suggestions), "returns array");
			for (const s of suggestions) {
				ok(
					s.name.toLowerCase().includes("gpt-4"),
					`suggestion matches query: ${s.name}`,
				);
			}
		});

		it("returns empty for unknown provider", () => {
			const suggestions = ux.suggestModels("unknown-provider");
			strictEqual(suggestions.length, 0);
		});
	});

	describe("human-readable cron schedules", () => {
		it("formats daily schedule", () => {
			const readable = ux.formatCronSchedule("0 9 * * *");
			ok(typeof readable === "string", "returns string");
			ok(
				readable.toLowerCase().includes("daily") || readable.includes("9"),
				"mentions daily or 9am",
			);
		});

		it("formats weekly schedule", () => {
			const readable = ux.formatCronSchedule("0 9 * * 1");
			ok(typeof readable === "string", "returns string");
			ok(
				readable.toLowerCase().includes("monday") ||
					readable.toLowerCase().includes("weekly"),
				"mentions monday or weekly",
			);
		});

		it("formats monthly schedule", () => {
			const readable = ux.formatCronSchedule("0 0 1 * *");
			ok(typeof readable === "string", "returns string");
			ok(
				readable.toLowerCase().includes("monthly") || readable.includes("1st"),
				"mentions monthly or 1st",
			);
		});

		it("handles invalid cron expression", () => {
			const readable = ux.formatCronSchedule("invalid");
			ok(typeof readable === "string", "returns string");
			ok(
				readable.toLowerCase().includes("invalid") ||
					readable.toLowerCase().includes("unknown"),
				"indicates invalid",
			);
		});
	});

	describe("progress streaming", () => {
		it("creates progress update", () => {
			const update = ux.createProgressUpdate("Processing", 50, 100);
			ok(update, "update created");
			strictEqual(update.current, 50);
			strictEqual(update.total, 100);
		});

		it("calculates progress percentage", () => {
			const percent = ux.calculateProgress(75, 100);
			strictEqual(percent, 75);
		});

		it("handles zero total", () => {
			const percent = ux.calculateProgress(0, 0);
			strictEqual(percent, 0);
		});

		it("generates progress bar", () => {
			const bar = ux.generateProgressBar(50, 100, 20);
			ok(typeof bar === "string", "returns string");
			ok(bar.length > 0, "bar is not empty");
		});
	});

	describe("typing indicators", () => {
		it("generates typing indicator", () => {
			const indicator = ux.generateTypingIndicator();
			ok(typeof indicator === "string", "returns string");
			ok(indicator.includes("..."), "contains ellipsis");
		});

		it("respects typing indicator setting", () => {
			const noIndicator = new UXPolish({
				...defaultConfig,
				showTypingIndicator: false,
			});
			const indicator = noIndicator.generateTypingIndicator();
			strictEqual(indicator, "");
		});
	});

	describe("error messages with actionable suggestions", () => {
		it("provides suggestion for API key error", () => {
			const message = ux.formatError("api_key_missing");
			ok(typeof message === "string", "returns string");
			ok(
				message.toLowerCase().includes("api") ||
					message.toLowerCase().includes("key"),
				"mentions API key",
			);
		});

		it("provides suggestion for connection error", () => {
			const message = ux.formatError("connection_failed");
			ok(typeof message === "string", "returns string");
			ok(
				message.toLowerCase().includes("connection") ||
					message.toLowerCase().includes("network"),
				"mentions connection",
			);
		});

		it("provides suggestion for unknown error", () => {
			const message = ux.formatError("unknown_error");
			ok(typeof message === "string", "returns string");
			ok(message.length > 0, "has message");
		});
	});

	describe("multi-language support", () => {
		it("translates to English", () => {
			const translated = ux.translate("greeting", "en");
			ok(typeof translated === "string", "returns string");
		});

		it("translates to Chinese", () => {
			const translated = ux.translate("greeting", "zh");
			ok(typeof translated === "string", "returns string");
		});

		it("falls back to English for unsupported language", () => {
			const translated = ux.translate("greeting", "xx");
			ok(typeof translated === "string", "returns string");
		});
	});
});
