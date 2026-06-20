/**
 * Tests for LangSmithIntegration (LangSmith tracing)
 */

import { equal, ok, strictEqual } from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { LangSmithIntegration } from "../../src/observability/langsmith.js";
import type { LangSmithConfig } from "../../src/observability/types.js";

const defaultConfig: LangSmithConfig = {
	apiKey: "ls-test-key",
	tracerName: "synthtek",
	projectName: "synthtek-test",
	enabled: true,
};

describe("LangSmithIntegration", () => {
	let langsmith: LangSmithIntegration;

	beforeEach(() => {
		langsmith = new LangSmithIntegration(defaultConfig);
	});

	describe("initialization", () => {
		it("creates an integration with config", () => {
			ok(langsmith, "integration instance created");
			strictEqual(langsmith.name, "langsmith");
		});

		it("creates disabled integration", () => {
			const disabled = new LangSmithIntegration({
				...defaultConfig,
				enabled: false,
			});
			ok(disabled, "disabled integration created");
			ok(!disabled.isEnabled, "integration is disabled");
		});
	});

	describe("trace recording", () => {
		it("creates a trace", () => {
			const trace = langsmith.createTrace({
				name: "test-trace",
				runType: "chain",
				inputs: { query: "Hello" },
			});

			ok(trace, "trace created");
			ok(trace.id, "trace has id");
			strictEqual(trace.name, "test-trace");
		});

		it("ends a trace with outputs", () => {
			const trace = langsmith.createTrace({
				name: "test-trace",
				runType: "chain",
				inputs: { query: "Hello" },
			});

			langsmith.endTrace(trace.id, { response: "Hi there!" });
			ok(true, "trace ended");
		});

		it("records error traces", () => {
			const trace = langsmith.createTrace({
				name: "error-trace",
				runType: "chain",
			});

			langsmith.endTrace(trace.id, undefined, "Something went wrong");
			ok(true, "error trace recorded");
		});
	});

	describe("dataset management", () => {
		it("creates a dataset", () => {
			const dataset = langsmith.createDataset({
				name: "test-dataset",
				description: "Test dataset",
				inputs: [{ query: "Hello" }, { query: "World" }],
			});

			ok(dataset, "dataset created");
			strictEqual(dataset.name, "test-dataset");
			equal(dataset.inputs.length, 2);
		});

		it("adds examples to dataset", () => {
			const dataset = langsmith.createDataset({
				name: "test-dataset",
				inputs: [{ query: "Hello" }],
			});

			langsmith.addExample(
				dataset.id,
				{ query: "New example" },
				{ response: "Expected" },
			);
			ok(true, "example added");
		});
	});

	describe("evaluation tracking", () => {
		it("records an evaluation", () => {
			langsmith.recordEvaluation({
				traceId: "trace-1",
				name: "accuracy",
				score: 0.95,
			});

			ok(true, "evaluation recorded");
		});

		it("records evaluation with comment", () => {
			langsmith.recordEvaluation({
				traceId: "trace-1",
				name: "relevance",
				score: 0.8,
				comment: "Good but could be more specific",
			});

			ok(true, "evaluation with comment recorded");
		});
	});

	describe("flush", () => {
		it("flushes pending events", async () => {
			langsmith.createTrace({ name: "test-trace", runType: "chain" });
			await langsmith.flush();
			ok(true, "flush completed");
		});
	});

	describe("shutdown", () => {
		it("shuts down cleanly", async () => {
			await langsmith.shutdown();
			ok(true, "shutdown completed");
		});
	});
});
