/**
 * Functional tests for frontend utility functions.
 * Tests pure functions extracted from frontend.html.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	escapeHtml,
	fmtDuration,
	fmtTime,
	formatTokens,
	parseSkillSource,
	renderMarkdown,
	statCard,
} from "../../src/webui/frontend-utils.js";

void describe("frontend-utils", () => {
	void describe("escapeHtml", () => {
		void it("escapes basic HTML entities", () => {
			assert.equal(
				escapeHtml("<script>alert('xss')</script>"),
				"&lt;script&gt;alert('xss')&lt;/script&gt;",
			);
		});

		void it("escapes ampersands", () => {
			assert.equal(escapeHtml("a & b"), "a &amp; b");
		});

		void it("escapes double quotes", () => {
			assert.equal(escapeHtml('say "hello"'), "say &quot;hello&quot;");
		});

		void it("returns empty string for empty input", () => {
			assert.equal(escapeHtml(""), "");
		});

		void it("passes through safe text unchanged", () => {
			assert.equal(escapeHtml("Hello, World!"), "Hello, World!");
		});
	});

	void describe("formatTokens", () => {
		void it("formats numbers under 1000", () => {
			assert.equal(formatTokens(0), "0");
			assert.equal(formatTokens(42), "42");
			assert.equal(formatTokens(999), "999");
		});

		void it("formats thousands with K suffix", () => {
			assert.equal(formatTokens(1000), "1.0K");
			assert.equal(formatTokens(1500), "1.5K");
			assert.equal(formatTokens(999999), "1000.0K");
		});

		void it("formats millions with M suffix", () => {
			assert.equal(formatTokens(1000000), "1.0M");
			assert.equal(formatTokens(2500000), "2.5M");
		});
	});

	void describe("fmtDuration", () => {
		void it("returns 0s for falsy values", () => {
			assert.equal(fmtDuration(0), "0s");
			assert.equal(fmtDuration(undefined as unknown as number), "0s");
			assert.equal(fmtDuration(null as unknown as number), "0s");
		});

		void it("formats milliseconds", () => {
			assert.equal(fmtDuration(500), "500ms");
		});

		void it("formats seconds", () => {
			assert.equal(fmtDuration(1500), "1.5s");
		});

		void it("formats minutes and seconds", () => {
			assert.equal(fmtDuration(125000), "2m 5s");
		});

		void it("formats hours and minutes", () => {
			assert.equal(fmtDuration(3725000), "1h 2m");
		});
	});

	void describe("fmtTime", () => {
		void it("formats a timestamp to HH:MM", () => {
			// Use epoch zero (Jan 1, 1970 00:00:00 UTC)
			const result = fmtTime(0);
			// Should include colon separator
			assert.ok(result.includes(":"));
			// Should be a reasonable time string length
			assert.ok(result.length >= 4 && result.length <= 10);
		});

		void it("returns a string", () => {
			const ts = new Date("2026-07-08T14:30:00Z").getTime();
			assert.equal(typeof fmtTime(ts), "string");
		});
	});

	void describe("statCard", () => {
		void it("generates a stat card with escaped label", () => {
			const result = statCard("Messages Sent", "42");
			assert.ok(result.includes('class="card stat-card"'));
			assert.ok(result.includes('class="value"'));
			assert.ok(result.includes(">42<"));
			assert.ok(result.includes("Messages Sent"));
		});

		void it("escapes HTML in label", () => {
			const result = statCard("<script>", "1");
			assert.ok(result.includes("&lt;script&gt;"));
			assert.ok(!result.includes("<script>"));
		});
	});

	void describe("parseSkillSource", () => {
		void it("returns null for empty input", () => {
			assert.equal(parseSkillSource(""), null);
			assert.equal(parseSkillSource(null as unknown as string), null);
			assert.equal(parseSkillSource(undefined as unknown as string), null);
		});

		void it("parses full GitHub URL", () => {
			const result = parseSkillSource("https://github.com/kane-mar/skills");
			assert.notEqual(result, null);
			assert.equal(result!.type, "github");
			assert.equal(result!.owner, "kane-mar");
			assert.equal(result!.name, "skills");
			assert.equal(result!.url, "https://github.com/kane-mar/skills");
		});

		void it("parses shorthand owner/name", () => {
			const result = parseSkillSource("kane-mar/skills");
			assert.notEqual(result, null);
			assert.equal(result!.type, "github");
			assert.equal(result!.owner, "kane-mar");
			assert.equal(result!.name, "skills");
		});
	});

	void describe("renderMarkdown", () => {
		void it("renders bold text", () => {
			const result = renderMarkdown("Hello **world**!");
			assert.ok(result.includes("<strong>world</strong>"));
		});

		void it("renders italic text", () => {
			const result = renderMarkdown("Hello *world*!");
			assert.ok(result.includes("<em>world</em>"));
		});

		void it("renders inline code", () => {
			const result = renderMarkdown("Use `code` here");
			assert.ok(result.includes("<code>code</code>"));
		});

		void it("renders links", () => {
			const result = renderMarkdown("[click](https://example.com)");
			assert.ok(result.includes('<a href="https://example.com"'));
			assert.ok(result.includes('target="_blank"'));
		});

		void it("escapes HTML in markdown", () => {
			const result = renderMarkdown("<script>alert('xss')</script>");
			assert.ok(!result.includes("<script>"));
			assert.ok(result.includes("&lt;script&gt;"));
		});

		void it("wraps content in paragraph tags", () => {
			const result = renderMarkdown("Hello");
			assert.ok(result.startsWith("<p>"));
			assert.ok(result.endsWith("</p>"));
		});
	});
});
