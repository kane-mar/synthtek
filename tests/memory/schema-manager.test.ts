/**
 * Tests for Schema Manager
 */

import assert from "node:assert";
import { before, describe, it } from "node:test";
import { SchemaManagerImpl } from "../../src/memory/schema-manager.js";

describe("SchemaManagerImpl", () => {
	let manager: SchemaManagerImpl;

	before(() => {
		manager = new SchemaManagerImpl();
	});

	describe("registerSchema", () => {
		it("should register a schema", () => {
			manager.registerSchema({
				name: "person",
				version: "1",
				fields: [
					{ name: "name", type: "string" },
					{ name: "age", type: "number" },
				],
				requiredFields: ["name"],
			});

			const schema = manager.getSchema("person");
			assert.ok(schema);
			assert.strictEqual(schema.name, "person");
		});
	});

	describe("getSchema", () => {
		it("should return null for non-existent schema", () => {
			const schema = manager.getSchema("nonexistent");
			assert.strictEqual(schema, null);
		});
	});

	describe("listSchemas", () => {
		it("should list all registered schemas", () => {
			manager.registerSchema({
				name: "test-schema",
				version: "1",
				fields: [{ name: "id", type: "string" }],
				requiredFields: ["id"],
			});

			const schemas = manager.listSchemas();
			assert.ok(schemas.length > 0);
		});
	});

	describe("validate", () => {
		it("should validate a correct entry", () => {
			const result = manager.validate({ name: "John", age: 30 }, "person");
			assert.ok(result.valid);
			assert.strictEqual(result.errors.length, 0);
		});

		it("should reject entry with missing required field", () => {
			const result = manager.validate({ age: 30 }, "person");
			assert.ok(!result.valid);
			assert.ok(result.errors.some((e) => e.includes("name")));
		});

		it("should reject entry with wrong field type", () => {
			const result = manager.validate(
				{ name: "John", age: "thirty" },
				"person",
			);
			assert.ok(!result.valid);
			assert.ok(result.errors.some((e) => e.includes("age")));
		});

		it("should return error for non-existent schema", () => {
			const result = manager.validate({}, "nonexistent");
			assert.ok(!result.valid);
			assert.ok(result.errors.some((e) => e.includes("not found")));
		});
	});

	describe("createTypedEntry", () => {
		it("should create entry with defaults", () => {
			manager.registerSchema({
				name: "task",
				version: "1",
				fields: [
					{ name: "title", type: "string" },
					{ name: "status", type: "string", defaultValue: "pending" },
				],
				requiredFields: ["title"],
			});

			const entry = manager.createTypedEntry("task", { title: "Test task" });
			assert.ok(entry);
			assert.strictEqual(entry?.title, "Test task");
			assert.strictEqual(entry?.status, "pending");
		});

		it("should return null for invalid entry", () => {
			const entry = manager.createTypedEntry("task", {});
			assert.strictEqual(entry, null);
		});

		it("should return null for non-existent schema", () => {
			const entry = manager.createTypedEntry("nonexistent", {});
			assert.strictEqual(entry, null);
		});
	});
});
