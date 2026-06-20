/**
 * Tests for AsyncFileService
 */

import { equal, ok } from "node:assert";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { AsyncFileService } from "../src/core/filesystem.js";

const TEST_DIR = join(process.cwd(), "tests", ".tmp");

describe("AsyncFileService", () => {
	let service: AsyncFileService;

	before(() => {
		if (!existsSync(TEST_DIR)) {
			mkdirSync(TEST_DIR, { recursive: true });
		}
		service = new AsyncFileService();
	});

	after(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true, force: true });
		}
	});

	describe("read", () => {
		it("reads a file successfully", async () => {
			const testFile = join(TEST_DIR, "read-test.txt");
			writeFileSync(testFile, "line1\nline2\nline3");

			const result = await service.read({ path: testFile });

			ok(result.success);
			equal(result.lines.length, 3);
			equal(result.content, "line1\nline2\nline3");
			equal(result.totalLines, 3);
			equal(result.truncated, false);
		});

		it("returns error for non-existent file", async () => {
			const result = await service.read({ path: "/nonexistent/file.txt" });

			equal(result.success, false);
			ok(result.error?.includes("not found"));
		});

		it("respects offset and limit", async () => {
			const testFile = join(TEST_DIR, "offset-test.txt");
			writeFileSync(testFile, "a\nb\nc\nd\ne");

			const result = await service.read({
				path: testFile,
				offset: 1,
				limit: 2,
			});

			ok(result.success);
			equal(result.lines.length, 2);
			equal(result.lines[0], "b");
			equal(result.lines[1], "c");
		});

		it("truncates when limit is smaller than file", async () => {
			const testFile = join(TEST_DIR, "truncate-test.txt");
			writeFileSync(testFile, "a\nb\nc\nd\ne");

			const result = await service.read({ path: testFile, limit: 2 });

			ok(result.success);
			equal(result.lines.length, 2);
			equal(result.truncated, true);
		});
	});

	describe("write", () => {
		it("writes a file successfully", async () => {
			const testFile = join(TEST_DIR, "write-test.txt");
			const result = await service.write({
				path: testFile,
				content: "hello world",
			});

			ok(result.success);
			ok(existsSync(testFile));
			equal(readFileSync(testFile, "utf-8"), "hello world");
		});

		it("creates directories when createDirectories is true", async () => {
			const testFile = join(TEST_DIR, "nested", "deep", "file.txt");
			const result = await service.write({
				path: testFile,
				content: "nested content",
				createDirectories: true,
			});

			ok(result.success);
			ok(existsSync(testFile));
		});

		it("rejects write when file exists and overwrite is false", async () => {
			const testFile = join(TEST_DIR, "overwrite-test.txt");
			writeFileSync(testFile, "existing");

			const result = await service.write({
				path: testFile,
				content: "new content",
				overwrite: false,
			});

			equal(result.success, false);
			ok(result.error?.includes("already exists"));
		});
	});

	describe("edit", () => {
		it("replaces text in a file", async () => {
			const testFile = join(TEST_DIR, "edit-test.txt");
			writeFileSync(testFile, "hello world");

			const result = await service.edit({
				path: testFile,
				oldText: "world",
				newText: "universe",
			});

			ok(result.success);
			equal(result.replacements, 1);
			equal(readFileSync(testFile, "utf-8"), "hello universe");
		});

		it("returns error when pattern not found", async () => {
			const testFile = join(TEST_DIR, "edit-nomatch.txt");
			writeFileSync(testFile, "hello world");

			const result = await service.edit({
				path: testFile,
				oldText: "nonexistent",
				newText: "replaced",
			});

			equal(result.success, false);
			equal(result.replacements, 0);
		});

		it("replaces all occurrences when replaceAll is true", async () => {
			const testFile = join(TEST_DIR, "edit-all.txt");
			writeFileSync(testFile, "aaa bbb aaa");

			const result = await service.edit({
				path: testFile,
				oldText: "aaa",
				newText: "ccc",
				replaceAll: true,
			});

			ok(result.success);
			equal(result.replacements, 2);
			equal(readFileSync(testFile, "utf-8"), "ccc bbb ccc");
		});
	});

	describe("exists", () => {
		it("returns true for existing file", async () => {
			const testFile = join(TEST_DIR, "exists-test.txt");
			writeFileSync(testFile, "test");

			const result = await service.exists(testFile);
			equal(result, true);
		});

		it("returns false for non-existing file", async () => {
			const result = await service.exists("/nonexistent/file.txt");
			equal(result, false);
		});
	});

	describe("stat", () => {
		it("returns file stats", async () => {
			const testFile = join(TEST_DIR, "stat-test.txt");
			writeFileSync(testFile, "test content");

			const result = await service.stat(testFile);

			ok(result !== null);
			equal(result?.isFile, true);
			equal(result?.isDirectory, false);
			ok(result?.size > 0);
		});

		it("returns null for non-existing file", async () => {
			const result = await service.stat("/nonexistent/file.txt");
			equal(result, null);
		});
	});

	describe("list", () => {
		it("lists directory entries", async () => {
			const testFile = join(TEST_DIR, "list-test.txt");
			writeFileSync(testFile, "test");

			const result = await service.list(TEST_DIR);

			ok(result.success);
			ok(result.entries.length > 0);
			ok(result.entries.some((e) => e.name === "list-test.txt"));
		});

		it("returns error for non-existing directory", async () => {
			const result = await service.list("/nonexistent/dir");

			equal(result.success, false);
			ok(result.error?.includes("not found"));
		});
	});
});
