/**
 * Agent Loop — Response Formatting Tests
 */

import assert from "node:assert/strict";
import test from "node:test";
import { AgentLoop } from "../../src/agent/loop.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function createLoop(
	responseFormat?: "markdown" | "json" | "plain" | "structured",
) {
	const loop = new AgentLoop(
		{
			systemPrompt: "You are a helpful assistant.",
			responseFormat,
			retry: {
				maxRetries: 0,
				initialDelay: 1,
				maxDelay: 10,
				multiplier: 1,
			},
		},
		{
			onAfterMessage: () => {},
		},
	);
	return loop;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test("formatResponse returns content as-is for markdown format", () => {
	const loop = createLoop("markdown");
	const content = "# Hello\n\nThis is **bold** and *italic*.";
	const result = loop.formatResponse(content, "markdown");
	assert.equal(result, content);
});

test("formatResponse strips markdown for plain format", () => {
	const loop = createLoop("plain");
	const content =
		"# Hello\n\nThis is **bold** and *italic*.\n\n- List item\n\n> Quote";
	const result = loop.formatResponse(content, "plain");

	// Should have stripped markdown
	assert.ok(!result.includes("#"));
	assert.ok(!result.includes("**"));
	assert.ok(!result.includes("*"));
	assert.ok(!result.includes("- "));
	assert.ok(!result.includes(">"));
	assert.ok(result.includes("Hello"));
	assert.ok(result.includes("bold"));
	assert.ok(result.includes("italic"));
});

test("formatResponse wraps non-JSON content in JSON envelope", () => {
	const loop = createLoop("json");
	const content = "Hello world";
	const result = loop.formatResponse(content, "json");

	const parsed = JSON.parse(result);
	assert.equal(parsed.format, "json");
	assert.equal(parsed.content, "Hello world");
	assert.equal(parsed.isRawText, true);
});

test("formatResponse pretty-prints valid JSON", () => {
	const loop = createLoop("json");
	const content = '{"name":"test","value":42}';
	const result = loop.formatResponse(content, "json");

	const parsed = JSON.parse(result);
	assert.equal(parsed.name, "test");
	assert.equal(parsed.value, 42);
	// Should be pretty-printed (contains newlines)
	assert.ok(result.includes("\n"));
});

test("formatAsStructured wraps text in structured envelope", () => {
	const loop = createLoop("structured");
	const content = "Hello world. This is a test message.";
	const result = loop.formatResponse(content, "structured");

	const parsed = JSON.parse(result);
	assert.equal(parsed.format, "structured");
	assert.equal(parsed.data, content);
	assert.equal(parsed.metadata.isStructured, false);
	assert.equal(parsed.metadata.type, "text");
	assert.equal(parsed.metadata.wordCount, 7);
	assert.equal(parsed.metadata.charCount, content.length);
	assert.equal(parsed.metadata.isMarkdown, false);
});

test("formatAsStructured detects markdown in content", () => {
	const loop = createLoop("structured");
	const content = "# Header\n\n**Bold** text";
	const result = loop.formatResponse(content, "structured");

	const parsed = JSON.parse(result);
	assert.equal(parsed.metadata.isMarkdown, true);
});

test("formatAsStructured wraps valid JSON data", () => {
	const loop = createLoop("structured");
	const content = '{"key":"value","arr":[1,2,3]}';
	const result = loop.formatResponse(content, "structured");

	const parsed = JSON.parse(result);
	assert.equal(parsed.format, "structured");
	assert.equal(parsed.metadata.type, "object");
	assert.equal(parsed.metadata.isStructured, true);
});

test("formatAsStructured detects array JSON data", () => {
	const loop = createLoop("structured");
	const content = "[1, 2, 3]";
	const result = loop.formatResponse(content, "structured");

	const parsed = JSON.parse(result);
	assert.equal(parsed.metadata.type, "array");
});

test("formatResponse defaults to markdown format", () => {
	const loop = createLoop();
	const content = "# Hello\n\nWorld";
	const result = loop.formatResponse(content);
	assert.equal(result, content);
});

test("formatResponse handles empty content", () => {
	const loop = createLoop("json");
	const result = loop.formatResponse("", "json");
	const parsed = JSON.parse(result);
	assert.equal(parsed.content, "");
	assert.equal(parsed.isRawText, true);
});

test("formatResponse handles code blocks in plain format", () => {
	const loop = createLoop("plain");
	const content =
		'Here is some code:\n\n```python\nprint("hello")\n```\n\nAnd inline `code`.';
	const result = loop.formatResponse(content, "plain");

	// Code blocks should be stripped entirely
	assert.ok(!result.includes("```"));
	assert.ok(!result.includes("python"));
	assert.ok(!result.includes("print"));
	// Inline code markers should be stripped but content preserved
	assert.ok(!result.includes("`"));
	assert.ok(result.includes("code"));
});

test("formatResponse normalizes excessive whitespace", () => {
	const loop = createLoop("plain");
	const content = "Line 1\n\n\n\n\n\nLine 2";
	const result = loop.formatResponse(content, "plain");
	assert.ok(!result.includes("\n\n\n")); // No triple newlines
});

test("formatResponse handles headers of all levels", () => {
	const loop = createLoop("plain");
	const content = "# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6";
	const result = loop.formatResponse(content, "plain");

	// Headers should be stripped of # markers
	assert.ok(!result.includes("#"));
	assert.ok(result.includes("H1"));
	assert.ok(result.includes("H6"));
});

test("formatResponse handles horizontal rules", () => {
	const loop = createLoop("plain");
	const content = "Before\n---\nAfter";
	const result = loop.formatResponse(content, "plain");
	assert.ok(!result.includes("---"));
	assert.ok(result.includes("Before"));
	assert.ok(result.includes("After"));
});

test("formatResponse handles blockquotes", () => {
	const loop = createLoop("plain");
	const content = "> This is a quote\n> with multiple lines";
	const result = loop.formatResponse(content, "plain");
	assert.ok(!result.includes(">"));
	assert.ok(result.includes("This is a quote"));
});

test("formatResponse handles list markers", () => {
	const loop = createLoop("plain");
	const content = "- Item 1\n- Item 2\n* Item 3\n+ Item 4";
	const result = loop.formatResponse(content, "plain");
	assert.ok(!result.includes("- "));
	assert.ok(!result.includes("* "));
	assert.ok(!result.includes("+ "));
	assert.ok(result.includes("Item 1"));
});
