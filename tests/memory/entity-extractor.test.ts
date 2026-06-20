/**
 * Tests for Entity Extractor
 */

import assert from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { EntityExtractorImpl } from "../../src/memory/entity-extractor.js";

describe("EntityExtractorImpl", () => {
	let tempDir: string;
	let extractor: EntityExtractorImpl;

	before(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "synthtek-entity-test-"));
		extractor = new EntityExtractorImpl({ storagePath: tempDir });
		await extractor.load();
	});

	after(async () => {
		await extractor.save();
		await rm(tempDir, { recursive: true, force: true });
	});

	describe("extractEntities", () => {
		it("should extract person entities", () => {
			const entities = extractor.extractEntities(
				"John Smith is a software engineer.",
			);
			const person = entities.find((e) => e.type === "Person");
			assert.ok(person, "Should extract Person entity");
			assert.ok(person.name.toLowerCase().includes("john"));
		});

		it("should extract organization entities", () => {
			const entities = extractor.extractEntities(
				"Google announced a new product.",
			);
			const org = entities.find((e) => e.type === "Organization");
			assert.ok(org, "Should extract Organization entity");
			assert.strictEqual(org.name, "Google");
		});

		it("should extract location entities", () => {
			const entities = extractor.extractEntities(
				"The meeting is in San Francisco.",
			);
			const location = entities.find((e) => e.type === "Location");
			assert.ok(location, "Should extract Location entity");
			assert.ok(location.name.toLowerCase().includes("san francisco"));
		});

		it("should extract date entities", () => {
			const entities = extractor.extractEntities(
				"The deadline is December 31, 2026.",
			);
			const date = entities.find((e) => e.type === "Date");
			assert.ok(date, "Should extract Date entity");
		});

		it("should extract event entities", () => {
			const entities = extractor.extractEntities(
				"The conference starts next week.",
			);
			const event = entities.find((e) => e.type === "Event");
			assert.ok(event, "Should extract Event entity");
		});

		it("should extract task entities", () => {
			const entities = extractor.extractEntities("TODO: Fix the login bug.");
			const task = entities.find((e) => e.type === "Task");
			assert.ok(task, "Should extract Task entity");
		});

		it("should return empty array for text without entities", () => {
			const entities = extractor.extractEntities(
				"This is just some random text.",
			);
			assert.ok(
				entities.length === 0 || entities.every((e) => e.type === "Concept"),
			);
		});

		it("should handle multiple entities in one text", () => {
			const entities = extractor.extractEntities(
				"John works at Google in San Francisco.",
			);
			assert.ok(entities.length >= 2);
		});
	});

	describe("getEntity / listEntities", () => {
		it("should store and retrieve extracted entities", () => {
			const entities = extractor.extractEntities("Alice works at Microsoft.");
			assert.ok(entities.length > 0);

			const firstEntity = entities[0];
			const retrieved = extractor.getEntity(firstEntity.id);
			assert.ok(retrieved);
			assert.strictEqual(retrieved.id, firstEntity.id);
		});

		it("should list entities by type", () => {
			extractor.extractEntities("Bob is a person.");
			extractor.extractEntities("Apple is a company.");

			const persons = extractor.listEntities("Person");
			assert.ok(persons.length > 0);

			const orgs = extractor.listEntities("Organization");
			assert.ok(orgs.length > 0);
		});

		it("should list all entities when no type specified", () => {
			const all = extractor.listEntities();
			assert.ok(Array.isArray(all));
		});
	});

	describe("updateEntity", () => {
		it("should update entity attributes", () => {
			const entities = extractor.extractEntities("Charlie is a developer.");
			assert.ok(entities.length > 0);

			const entity = entities[0];
			extractor.updateEntity(entity.id, {
				attributes: { ...entity.attributes, role: "senior-developer" },
			});

			const updated = extractor.getEntity(entity.id);
			assert.ok(updated);
			assert.strictEqual(updated.attributes.role, "senior-developer");
		});

		it("should not crash when updating non-existent entity", () => {
			assert.doesNotThrow(() => {
				extractor.updateEntity("non-existent-id", { attributes: {} });
			});
		});
	});

	describe("persistence", () => {
		it("should save and load entities", async () => {
			extractor.extractEntities("David is from London.");
			await extractor.save();

			const newExtractor = new EntityExtractorImpl({ storagePath: tempDir });
			await newExtractor.load();

			const loaded = newExtractor.listEntities();
			assert.ok(loaded.length > 0);
		});
	});
});
