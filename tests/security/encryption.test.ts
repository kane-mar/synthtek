/**
 * Tests for API Key Encryption at Rest
 */

import assert from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { ApiKeyEncryption } from "../../src/security/encryption.js";

describe("ApiKeyEncryption", () => {
	let tempDir: string;
	let encryption: ApiKeyEncryption;

	before(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "synthtek-encryption-test-"));
		encryption = new ApiKeyEncryption({
			algorithm: "aes-256-gcm",
			iterations: 100_000,
			useKeyFile: false,
		});
	});

	after(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	describe("encrypt", () => {
		it("should encrypt a plaintext API key", async () => {
			const result = await encryption.encrypt("sk-test-key-12345");
			assert.ok(result.success);
			assert.ok(result.value);
			assert.strictEqual(result.error, undefined);
		});

		it("should return different ciphertext for same input", async () => {
			const key = "sk-same-key";
			const r1 = await encryption.encrypt(key);
			const r2 = await encryption.encrypt(key);
			assert.ok(r1.success && r2.success);
			assert.notStrictEqual(
				r1.value,
				r2.value,
				"Ciphertext should differ due to random IV/salt",
			);
		});

		it("should include IV, salt, and tag in encrypted output", async () => {
			const result = await encryption.encrypt("sk-test");
			assert.ok(result.success && result.value);
			const parsed = JSON.parse(result.value);
			assert.ok(parsed.ciphertext);
			assert.ok(parsed.iv);
			assert.ok(parsed.salt);
			assert.ok(parsed.tag);
			assert.ok(parsed.timestamp);
		});
	});

	describe("decrypt", () => {
		it("should decrypt an encrypted API key", async () => {
			const original = "sk-original-key-abc";
			const encrypted = await encryption.encrypt(original);
			assert.ok(encrypted.success && encrypted.value);

			const decrypted = await encryption.decrypt(encrypted.value);
			assert.ok(decrypted.success);
			assert.strictEqual(decrypted.value, original);
		});

		it("should fail to decrypt tampered ciphertext", async () => {
			const encrypted = await encryption.encrypt("sk-test");
			assert.ok(encrypted.success && encrypted.value);

			const parsed = JSON.parse(encrypted.value);
			parsed.ciphertext = "tampered-data";
			const tampered = JSON.stringify(parsed);

			const decrypted = await encryption.decrypt(tampered);
			assert.ok(!decrypted.success);
			assert.ok(decrypted.error);
		});

		it("should fail to decrypt invalid JSON", async () => {
			const decrypted = await encryption.decrypt("not-json");
			assert.ok(!decrypted.success);
		});

		it("should fail to decrypt empty string", async () => {
			const decrypted = await encryption.decrypt("");
			assert.ok(!decrypted.success);
		});
	});

	describe("encryptMany / decryptMany", () => {
		it("should encrypt and decrypt multiple keys", async () => {
			const keys = ["sk-key-1", "sk-key-2", "sk-key-3"];
			const encrypted = await encryption.encryptMany(keys);
			assert.strictEqual(encrypted.length, keys.length);

			const encryptedValues = encrypted
				.map((e) => e.value!)
				.filter(Boolean) as string[];
			const decrypted = await encryption.decryptMany(encryptedValues);

			for (let i = 0; i < keys.length; i++) {
				assert.strictEqual(decrypted[i].value, keys[i]);
			}
		});
	});

	describe("key file mode", () => {
		it("should save and load encryption key from file", async () => {
			const keyPath = join(tempDir, "encryption-key.json");
			const fileEncryption = new ApiKeyEncryption({
				algorithm: "aes-256-gcm",
				iterations: 100_000,
				useKeyFile: true,
				keyFilePath: keyPath,
			});

			// Encrypt something
			const enc = await fileEncryption.encrypt("sk-file-test");
			assert.ok(enc.success);

			// Create a new instance loading from the same key file
			const fileEncryption2 = new ApiKeyEncryption({
				algorithm: "aes-256-gcm",
				iterations: 100_000,
				useKeyFile: true,
				keyFilePath: keyPath,
			});

			// Should be able to decrypt with the same key
			const dec = await fileEncryption2.decrypt(enc.value!);
			assert.ok(dec.success);
			assert.strictEqual(dec.value, "sk-file-test");
		});
	});

	describe("AES-256-CBC mode", () => {
		it("should encrypt and decrypt using CBC mode", async () => {
			const cbcEncryption = new ApiKeyEncryption({
				algorithm: "aes-256-cbc",
				iterations: 100_000,
				useKeyFile: false,
			});

			const enc = await cbcEncryption.encrypt("sk-cbc-test");
			assert.ok(enc.success);

			const dec = await cbcEncryption.decrypt(enc.value!);
			assert.ok(dec.success);
			assert.strictEqual(dec.value, "sk-cbc-test");
		});
	});

	describe("round-trip integrity", () => {
		it("should preserve special characters in API keys", async () => {
			const specialKey = "sk-test-key!@#$%^&*()_+-=[]{}|;:,.<>?";
			const enc = await encryption.encrypt(specialKey);
			assert.ok(enc.success);

			const dec = await encryption.decrypt(enc.value!);
			assert.ok(dec.success);
			assert.strictEqual(dec.value, specialKey);
		});

		it("should handle long API keys", async () => {
			const longKey = `sk-${"a".repeat(500)}`;
			const enc = await encryption.encrypt(longKey);
			assert.ok(enc.success);

			const dec = await encryption.decrypt(enc.value!);
			assert.ok(dec.success);
			assert.strictEqual(dec.value, longKey);
		});
	});
});
