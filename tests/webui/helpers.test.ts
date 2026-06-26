/**
 * WebUI Helpers Tests
 * Tests for extracted server utility functions.
 */
import { equal, ok } from "node:assert";
import { describe, it } from "node:test";
import { MIME_TYPES, sendJson } from "../../src/webui/helpers.js";

describe("WebUI Helpers", () => {
	it("MIME_TYPES maps common extensions", () => {
		ok(MIME_TYPES[".html"]);
		equal(MIME_TYPES[".html"], "text/html; charset=utf-8");
		ok(MIME_TYPES[".css"]);
		ok(MIME_TYPES[".js"]);
		ok(MIME_TYPES[".json"]);
		ok(MIME_TYPES[".png"]);
		ok(MIME_TYPES[".ico"]);
	});

	it("sendJson is a function", () => {
		equal(typeof sendJson, "function");
	});
});
