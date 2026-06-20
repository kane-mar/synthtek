/**
 * Agent Response Formatter Tests
 * Tests for the extracted response formatting logic from AgentLoop.
 */

import { equal, ok } from "node:assert";
import { describe, it } from "node:test";
import { ResponseFormatter } from "../../src/agent/response-formatter.js";

describe("ResponseFormatter", () => {
	describe("markdown format", () => {
		it("returns plain text for simple responses", () => {
			const formatter = new ResponseFormatter();
			const result = formatter.format("Hello world", "markdown");
			equal(result, "Hello world");
		});

		it("preserves markdown formatting", () => {
			const formatter = new ResponseFormatter();
			const result = formatter.format("# Heading\n\n**Bold** text", "markdown");
			ok(result.includes("# Heading"));
			ok(result.includes("**Bold**"));
		});

		it("handles code blocks", () => {
			const formatter = new ResponseFormatter();
			const result = formatter.format(
				'```python\nprint("hello")\n```',
				"markdown",
			);
			ok(result.includes("```python"));
		});
	});

	describe("json format", () => {
		it("wraps response in JSON object", () => {
			const formatter = new ResponseFormatter();
			const result = formatter.format("Hello world", "json");
			const parsed = JSON.parse(result);
			equal(parsed.content, "Hello world");
			equal(parsed.format, "json");
		});

		it("handles multiline content", () => {
			const formatter = new ResponseFormatter();
			const result = formatter.format("Line 1\nLine 2", "json");
			const parsed = JSON.parse(result);
			equal(parsed.content, "Line 1\nLine 2");
		});
	});

	describe("plain format", () => {
		it("strips markdown formatting", () => {
			const formatter = new ResponseFormatter();
			const result = formatter.format(
				"# Heading\n\n**Bold** text\n\n- item",
				"plain",
			);
			ok(!result.includes("#"));
			ok(!result.includes("**"));
		});

		it("preserves basic text", () => {
			const formatter = new ResponseFormatter();
			const result = formatter.format("Hello world", "plain");
			equal(result, "Hello world");
		});
	});

	describe("structured format", () => {
		it("returns structured object as JSON string", () => {
			const formatter = new ResponseFormatter();
			const result = formatter.format("Hello world", "structured");
			const parsed = JSON.parse(result);
			ok(parsed.format === "structured");
			ok(parsed.data);
			ok(parsed.metadata);
		});

		it("includes metadata with type and counts", () => {
			const formatter = new ResponseFormatter();
			const result = formatter.format("Hello world", "structured");
			const parsed = JSON.parse(result);
			ok(parsed.metadata.type);
			ok(parsed.metadata.wordCount >= 0);
			ok(parsed.metadata.charCount >= 0);
		});
	});

	describe("format detection", () => {
		it("detects markdown format from config", () => {
			const formatter = new ResponseFormatter({ responseFormat: "markdown" });
			equal(formatter.detectFormat(), "markdown");
		});

		it("defaults to markdown when unspecified", () => {
			const formatter = new ResponseFormatter();
			equal(formatter.detectFormat(), "markdown");
		});
	});
});
