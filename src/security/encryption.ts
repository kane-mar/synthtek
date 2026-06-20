/**
 * API Key Encryption at Rest
 *
 * Encrypts API keys before storing them to disk using AES-256-GCM or AES-256-CBC.
 * Supports key file persistence for cross-session decryption.
 */

import {
	createCipheriv,
	createDecipheriv,
	randomBytes,
	scryptSync,
} from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import type { EncryptionConfig, EncryptionResult } from "./types.js";

const DEFAULT_CONFIG: Required<
	Omit<EncryptionConfig, "useKeyFile" | "keyFilePath">
> = {
	algorithm: "aes-256-gcm",
	iterations: 100_000,
};

const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH_GCM = 12; // 96 bits recommended for GCM
const IV_LENGTH_CBC = 16; // 128 bits for CBC
const SALT_LENGTH = 16;

interface EncryptedPayload {
	ciphertext: string;
	iv: string;
	salt: string;
	tag?: string;
	timestamp: number;
}

export class ApiKeyEncryption {
	private readonly config: EncryptionConfig;
	private masterKey: Buffer | null = null;

	constructor(config: Partial<EncryptionConfig> = {}) {
		this.config = {
			algorithm: config.algorithm ?? DEFAULT_CONFIG.algorithm,
			iterations: config.iterations ?? DEFAULT_CONFIG.iterations,
			useKeyFile: config.useKeyFile ?? false,
			keyFilePath: config.keyFilePath,
		};
	}

	/**
	 * Initialize the encryption instance.
	 * Loads or generates the master key.
	 */
	async init(): Promise<void> {
		if (this.config.useKeyFile && this.config.keyFilePath) {
			await this.loadKeyFromFile();
		}
		if (!this.masterKey) {
			this.masterKey = randomBytes(KEY_LENGTH);
		}
	}

	/**
	 * Encrypt a plaintext value.
	 */
	async encrypt(plaintext: string): Promise<EncryptionResult> {
		try {
			if (!this.masterKey) {
				await this.init();
			}

			const salt = randomBytes(SALT_LENGTH);
			const ivLength =
				this.config.algorithm === "aes-256-gcm" ? IV_LENGTH_GCM : IV_LENGTH_CBC;
			const iv = randomBytes(ivLength);

			// Derive encryption key from master key + salt
			const derivedKey = scryptSync(this.masterKey!, salt, KEY_LENGTH);

			const encrypted = this.encryptWithKey(derivedKey, iv, plaintext);

			const payload: EncryptedPayload = {
				ciphertext: encrypted.ciphertext,
				iv: iv.toString("base64"),
				salt: salt.toString("base64"),
				tag: encrypted.tag,
				timestamp: Date.now(),
			};

			// Persist key file if configured
			if (this.config.useKeyFile && this.config.keyFilePath) {
				await this.saveKeyToFile();
			}

			return {
				success: true,
				value: JSON.stringify(payload),
			};
		} catch (error) {
			return {
				success: false,
				error: (error as Error).message,
			};
		}
	}

	/**
	 * Decrypt an encrypted value.
	 */
	async decrypt(encryptedValue: string): Promise<EncryptionResult> {
		try {
			if (!this.masterKey) {
				await this.init();
			}

			let payload: EncryptedPayload;
			try {
				payload = JSON.parse(encryptedValue) as EncryptedPayload;
			} catch {
				return { success: false, error: "Invalid encrypted payload format" };
			}

			if (!payload.ciphertext || !payload.iv || !payload.salt) {
				return {
					success: false,
					error: "Missing required fields in encrypted payload",
				};
			}

			const salt = Buffer.from(payload.salt, "base64");
			const iv = Buffer.from(payload.iv, "base64");

			// Derive encryption key from master key + salt
			const derivedKey = scryptSync(this.masterKey!, salt, KEY_LENGTH);

			const decrypted = this.decryptWithKey(
				derivedKey,
				iv,
				payload.ciphertext,
				payload.tag,
			);

			return {
				success: true,
				value: decrypted,
			};
		} catch (error) {
			return {
				success: false,
				error: (error as Error).message,
			};
		}
	}

	/**
	 * Encrypt multiple values at once.
	 */
	async encryptMany(values: string[]): Promise<EncryptionResult[]> {
		return Promise.all(values.map((v) => this.encrypt(v)));
	}

	/**
	 * Decrypt multiple values at once.
	 */
	async decryptMany(values: string[]): Promise<EncryptionResult[]> {
		return Promise.all(values.map((v) => this.decrypt(v)));
	}

	/**
	 * Get the current master key (for debugging/testing).
	 * Never expose this in production.
	 */
	getMasterKey(): string | null {
		return this.masterKey ? this.masterKey.toString("base64") : null;
	}

	// ── Private helpers ──────────────────────────────────────────────────────

	private encryptWithKey(
		key: Buffer,
		iv: Buffer,
		plaintext: string,
	): { ciphertext: string; tag?: string } {
		const plaintextBuf = Buffer.from(plaintext, "utf-8");

		if (this.config.algorithm === "aes-256-gcm") {
			const cipher = createCipheriv("aes-256-gcm", key, iv);
			const encrypted = Buffer.concat([
				cipher.update(plaintextBuf),
				cipher.final(),
			]);
			const tag = cipher.getAuthTag();

			return {
				ciphertext: encrypted.toString("base64"),
				tag: tag.toString("base64"),
			};
		} else {
			const cipher = createCipheriv("aes-256-cbc", key, iv);
			const encrypted = Buffer.concat([
				cipher.update(plaintextBuf),
				cipher.final(),
			]);

			return {
				ciphertext: encrypted.toString("base64"),
			};
		}
	}

	private decryptWithKey(
		key: Buffer,
		iv: Buffer,
		ciphertext: string,
		tag?: string,
	): string {
		const ciphertextBuf = Buffer.from(ciphertext, "base64");

		if (this.config.algorithm === "aes-256-gcm") {
			const decipher = createDecipheriv("aes-256-gcm", key, iv);
			if (tag) {
				decipher.setAuthTag(Buffer.from(tag, "base64"));
			}
			const decrypted = Buffer.concat([
				decipher.update(ciphertextBuf),
				decipher.final(),
			]);

			return decrypted.toString("utf-8");
		} else {
			const decipher = createDecipheriv("aes-256-cbc", key, iv);
			const decrypted = Buffer.concat([
				decipher.update(ciphertextBuf),
				decipher.final(),
			]);

			return decrypted.toString("utf-8");
		}
	}

	private async loadKeyFromFile(): Promise<void> {
		if (!this.config.keyFilePath) return;

		try {
			await access(this.config.keyFilePath);
			const content = await readFile(this.config.keyFilePath, "utf-8");
			const data = JSON.parse(content) as { key: string };
			this.masterKey = Buffer.from(data.key, "base64");
		} catch {
			// Key file doesn't exist, will generate new one
			this.masterKey = randomBytes(KEY_LENGTH);
		}
	}

	private async saveKeyToFile(): Promise<void> {
		if (!this.config.keyFilePath || !this.masterKey) return;

		await writeFile(
			this.config.keyFilePath,
			JSON.stringify({ key: this.masterKey.toString("base64") }),
			"utf-8",
		);
	}
}
