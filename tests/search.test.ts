/**
 * Tests for SearchService (glob and grep)
 */

import { equal, ok } from "node:assert";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { SearchService } from "../src/core/search.js";

const TEST_DIR = join(process.cwd(), "tests", ".tmp-search");

describe("SearchService", () => {
	let service: SearchService;

	before(() => {
		service = new SearchService();
		if (!existsSync(TEST_DIR)) {
			mkdirSync(TEST_DIR, { recursive: true });
		}

		// Create test files
		writeFileSync(
			join(TEST_DIR, "file1.txt"),
			"hello world\nfoo bar\nhello again",
		);
		writeFileSync(
			join(TEST_DIR, "file2.txt"),
			"another file\nwith different content",
		);
		writeFileSync(
			join(TEST_DIR, "file3.md"),
			"# Markdown\nSome text\nhello here",
		);
	});

	after(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true, force: true });
		}
	});

	describe("glob", () => {
		it("finds files matching a pattern", async () => {
			const result = await service.glob({ pattern: "*.txt", path: TEST_DIR });

			equal(result.matches.length, 2);
			equal(result.total, 2);
			equal(result.truncated, false);
		});

		it("finds files with specific extension", async () => {
			const result = await service.glob({ pattern: "*.md", path: TEST_DIR });

			equal(result.matches.length, 1);
			ok(result.matches[0].includes("file3.md"));
		});

		it("respects headLimit", async () => {
			const result = await service.glob({
				pattern: "*",
				path: TEST_DIR,
				headLimit: 2,
			});

			equal(result.matches.length, 2);
			equal(result.total, 3);
			equal(result.truncated, true);
		});

		it("applies offset", async () => {
			const result = await service.glob({
				pattern: "*",
				path: TEST_DIR,
				offset: 1,
			});

			equal(result.matches.length, 2);
			equal(result.total, 3);
		});
	});

	describe("grep", () => {
		it("finds files containing a pattern", async () => {
			const result = await service.grep({
				pattern: "hello",
				path: TEST_DIR,
				outputMode: "files_with_matches",
			});

			equal(result.filesWithMatches.length, 2);
			equal(result.totalMatches, 3);
		});

		it("returns content matches when requested", async () => {
			const result = await service.grep({
				pattern: "hello",
				path: TEST_DIR,
				outputMode: "content",
			});

			equal(result.totalMatches, 3);
			ok(result.matches.length > 0);
			ok(result.matches[0].content.includes("hello"));
		});

		it("is case insensitive when requested", async () => {
			const result = await service.grep({
				pattern: "HELLO",
				path: TEST_DIR,
				caseInsensitive: true,
				outputMode: "files_with_matches",
			});

			equal(result.filesWithMatches.length, 2);
		});

		it("returns counts when requested", async () => {
			const result = await service.grep({
				pattern: "hello",
				path: TEST_DIR,
				outputMode: "count",
			});

			ok(Object.keys(result.counts).length > 0);
			const total = Object.values(result.counts).reduce((a, b) => a + b, 0);
			equal(total, 3);
		});

		it("filters by glob pattern", async () => {
			const result = await service.grep({
				pattern: "hello",
				path: TEST_DIR,
				glob: "*.md",
				outputMode: "files_with_matches",
			});

			equal(result.filesWithMatches.length, 1);
			ok(result.filesWithMatches[0].includes("file3.md"));
		});

		it("handles fixed strings", async () => {
			const result = await service.grep({
				pattern: "foo",
				path: TEST_DIR,
				fixedStrings: true,
				outputMode: "files_with_matches",
			});

			equal(result.filesWithMatches.length, 1);
		});

		it("applies headLimit to results", async () => {
			const result = await service.grep({
				pattern: "hello",
				path: TEST_DIR,
				outputMode: "content",
				headLimit: 2,
			});

			equal(result.matches.length, 2);
			equal(result.truncated, true);
		});
	});
});
