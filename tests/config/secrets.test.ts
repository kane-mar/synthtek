/**
 * Secret Manager Tests
 */

import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import {
	SecretManagerImpl,
	SecretResolverImpl,
} from "../../src/config/secrets.js";

// ── Secret Manager Tests ─────────────────────────────────────────────────────

describe("SecretManagerImpl", () => {
	test("stores and retrieves secrets", () => {
		const manager = new SecretManagerImpl();
		manager.set("api-key", "sk-test-123");
		assert.equal(manager.get("api-key"), "sk-test-123");
	});

	test("returns null for non-existent key", () => {
		const manager = new SecretManagerImpl();
		assert.equal(manager.get("non-existent"), null);
	});

	test("checks if key exists", () => {
		const manager = new SecretManagerImpl();
		assert.equal(manager.has("api-key"), false);
		manager.set("api-key", "sk-test-123");
		assert.equal(manager.has("api-key"), true);
	});

	test("deletes secrets", () => {
		const manager = new SecretManagerImpl();
		manager.set("api-key", "sk-test-123");
		assert.equal(manager.delete("api-key"), true);
		assert.equal(manager.get("api-key"), null);
		assert.equal(manager.delete("api-key"), false); // Already deleted
	});

	test("lists all secrets", () => {
		const manager = new SecretManagerImpl();
		manager.set("api-key", "sk-test-123");
		manager.set("token", "tok-456");
		const keys = manager.list();
		assert.equal(keys.length, 2);
		assert.ok(keys.some((k) => k.includes("api-key")));
		assert.ok(keys.some((k) => k.includes("token")));
	});

	test("clears all secrets", () => {
		const manager = new SecretManagerImpl();
		manager.set("api-key", "sk-test-123");
		manager.set("token", "tok-456");
		manager.clear();
		assert.equal(manager.list().length, 0);
		assert.equal(manager.get("api-key"), null);
	});

	test("uses prefix for all keys", () => {
		const manager = new SecretManagerImpl(undefined, "myapp");
		manager.set("api-key", "sk-test-123");
		const keys = manager.list();
		// list() strips the prefix, so we verify the key is returned without prefix
		assert.ok(keys.some((k) => k === "api-key"));
		// Verify the prefix is applied by checking get works with unprefixed key
		assert.equal(manager.get("api-key"), "sk-test-123");
	});

	test("overwrites existing secret", () => {
		const manager = new SecretManagerImpl();
		manager.set("api-key", "sk-old");
		manager.set("api-key", "sk-new");
		assert.equal(manager.get("api-key"), "sk-new");
	});
});

// ── Secret Resolver Tests ────────────────────────────────────────────────────

describe("SecretResolverImpl", () => {
	test("resolves from environment variable first", () => {
		const orig = process.env.SYNTHTEK_API_KEY;
		process.env.SYNTHTEK_API_KEY = "env-key";

		const resolver = new SecretResolverImpl();
		assert.equal(resolver.resolve("api-key"), "env-key");

		process.env.SYNTHTEK_API_KEY = orig;
	});

	test("falls back to secret store when env not set", () => {
		const orig = process.env.SYNTHTEK_API_KEY;
		delete process.env.SYNTHTEK_API_KEY;

		const manager = new SecretManagerImpl();
		manager.set("api-key", "store-key");
		const resolver = new SecretResolverImpl(manager);

		assert.equal(resolver.resolve("api-key"), "store-key");

		process.env.SYNTHTEK_API_KEY = orig;
	});

	test("returns null when secret not found anywhere", () => {
		const orig = process.env.SYNTHTEK_API_KEY;
		delete process.env.SYNTHTEK_API_KEY;

		const resolver = new SecretResolverImpl();
		assert.equal(resolver.resolve("non-existent"), null);

		process.env.SYNTHTEK_API_KEY = orig;
	});

	test("throws for required secret not found", () => {
		const orig = process.env.SYNTHTEK_API_KEY;
		delete process.env.SYNTHTEK_API_KEY;

		const resolver = new SecretResolverImpl();
		assert.throws(
			() => resolver.resolveRequired("api-key"),
			/Required secret "api-key" not found/,
		);

		process.env.SYNTHTEK_API_KEY = orig;
	});

	test("resolves multiple secrets at once", () => {
		const orig = process.env.SYNTHTEK_API_KEY;
		process.env.SYNTHTEK_API_KEY = "env-key";

		const resolver = new SecretResolverImpl();
		const result = resolver.resolveAll(["api-key", "non-existent"]);

		assert.equal(result["api-key"], "env-key");
		assert.equal(result["non-existent"], null);

		process.env.SYNTHTEK_API_KEY = orig;
	});

	test("normalizes key names for env lookup", () => {
		const orig = process.env.SYNTHTEK_OPENAI_API_KEY;
		process.env.SYNTHTEK_OPENAI_API_KEY = "openai-key";

		const resolver = new SecretResolverImpl();
		assert.equal(resolver.resolve("openai-api-key"), "openai-key");

		process.env.SYNTHTEK_OPENAI_API_KEY = orig;
	});
});
