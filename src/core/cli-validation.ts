/**
 * CLI Input Validation Module
 *
 * Provides input sanitization, path validation, rate limiting,
 * and allowlisting for CLI commands to prevent security issues
 * like path traversal, command injection, and DoS.
 */

import { isAbsolute, resolve } from "node:path";

// ─── Constants ───────────────────────────────────────────────────────────────

/** Maximum allowed length for config keys */
const MAX_CONFIG_KEY_LENGTH = 256;

/** Maximum allowed length for config values */
const MAX_CONFIG_VALUE_LENGTH = 65536;

/** Allowed characters in config keys (alphanumeric, dots, underscores, hyphens) */
const CONFIG_KEY_PATTERN = /^[a-zA-Z0-9._-]+$/;

/** Maximum number of CLI operations per minute */

// ─── Path Validation ─────────────────────────────────────────────────────────

/**
 * Sanitize a file path to prevent path traversal attacks.
 * Rejects paths containing '..' or attempting to escape the workspace.
 *
 * @param inputPath - The user-provided path
 * @param workspaceRoot - The workspace root to constrain paths within
 * @returns The sanitized absolute path
 * @throws Error if the path is invalid or attempts traversal
 */
export function sanitizePath(
	inputPath: string,
	workspaceRoot: string = process.cwd(),
): string {
	if (!inputPath || typeof inputPath !== "string") {
		throw new ValidationError("Path must be a non-empty string");
	}

	// Reject paths with traversal sequences
	if (inputPath.includes("..")) {
		throw new ValidationError(
			`Path contains traversal sequences: "${inputPath}"`,
		);
	}

	// Reject null bytes
	if (inputPath.includes("\0")) {
		throw new ValidationError("Path contains null bytes");
	}

	// Resolve to absolute path
	const resolvedPath = isAbsolute(inputPath)
		? inputPath
		: resolve(workspaceRoot, inputPath);

	// Ensure the resolved path is within the workspace
	const normalizedWorkspace = resolve(workspaceRoot);
	if (!resolvedPath.startsWith(normalizedWorkspace)) {
		throw new ValidationError(
			`Path "${inputPath}" resolves outside workspace "${normalizedWorkspace}"`,
		);
	}

	return resolvedPath;
}

// ─── Config Key Validation ───────────────────────────────────────────────────

/**
 * Validate a configuration key name.
 *
 * @param key - The config key to validate
 * @throws Error if the key is invalid
 */
export function validateConfigKey(key: string): void {
	if (!key || typeof key !== "string") {
		throw new ValidationError("Config key must be a non-empty string");
	}

	if (key.length > MAX_CONFIG_KEY_LENGTH) {
		throw new ValidationError(
			`Config key exceeds maximum length of ${MAX_CONFIG_KEY_LENGTH} characters`,
		);
	}

	if (!CONFIG_KEY_PATTERN.test(key)) {
		throw new ValidationError(
			`Config key contains invalid characters. Only alphanumeric, dots, underscores, and hyphens are allowed: "${key}"`,
		);
	}
}

/**
 * Validate a configuration value.
 *
 * @param value - The config value to validate
 * @throws Error if the value is invalid
 */
export function validateConfigValue(value: string): void {
	if (typeof value !== "string") {
		throw new ValidationError("Config value must be a string");
	}

	if (value.length > MAX_CONFIG_VALUE_LENGTH) {
		throw new ValidationError(
			`Config value exceeds maximum length of ${MAX_CONFIG_VALUE_LENGTH} characters`,
		);
	}
}

// ─── Command Validation ──────────────────────────────────────────────────────

/**
 * Validate a shell command string for safety.
 * Rejects commands with dangerous patterns.
 *
 * @param command - The command to validate
 * @throws Error if the command contains dangerous patterns
 */
export function validateCommand(command: string): void {
	if (!command || typeof command !== "string") {
		throw new ValidationError("Command must be a non-empty string");
	}

	if (command.length > 4096) {
		throw new ValidationError(
			"Command exceeds maximum length of 4096 characters",
		);
	}

	// Reject null bytes
	if (command.includes("\0")) {
		throw new ValidationError("Command contains null bytes");
	}

	// Reject commands that attempt to overwrite system files
	const dangerousPatterns = [
		/sudo\s+/i,
		/rm\s+-[rf]/,
		/mkfs\s+/i,
		/dd\s+if=/i,
		/format\s+/i,
	];

	for (const pattern of dangerousPatterns) {
		if (pattern.test(command)) {
			throw new ValidationError(
				`Command contains dangerous pattern: ${pattern.source}`,
			);
		}
	}
}

// ─── Rate Limiter (re-exported from security module) ─────────────────────────
/**
 * Rate limiter for CLI operations.
 * Delegates to the security module's implementation.
 */
export { RateLimiter } from "../security/rate-limiter.js";

// ─── Validation Error ────────────────────────────────────────────────────────

/**
 * Custom error class for validation failures.
 */
export class ValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ValidationError";
	}
}

// ─── Glob Pattern Validation ─────────────────────────────────────────────────

/**
 * Validate a glob pattern for safety.
 *
 * @param pattern - The glob pattern to validate
 * @throws Error if the pattern is invalid
 */
export function validateGlobPattern(pattern: string): void {
	if (!pattern || typeof pattern !== "string") {
		throw new ValidationError("Glob pattern must be a non-empty string");
	}

	if (pattern.length > 1024) {
		throw new ValidationError(
			"Glob pattern exceeds maximum length of 1024 characters",
		);
	}

	// Reject patterns with traversal sequences
	if (pattern.includes("..")) {
		throw new ValidationError("Glob pattern contains traversal sequences");
	}

	// Reject null bytes
	if (pattern.includes("\0")) {
		throw new ValidationError("Glob pattern contains null bytes");
	}
}

// ─── Timeout Validation ──────────────────────────────────────────────────────

/**
 * Validate a timeout value.
 *
 * @param timeout - The timeout in seconds
 * @param maxTimeout - Maximum allowed timeout (default 3600 = 1 hour)
 * @throws Error if the timeout is invalid
 */
export function validateTimeout(
	timeout: number,
	maxTimeout: number = 3600,
): void {
	if (!Number.isFinite(timeout) || timeout <= 0) {
		throw new ValidationError("Timeout must be a positive number");
	}

	if (timeout > maxTimeout) {
		throw new ValidationError(
			`Timeout exceeds maximum of ${maxTimeout} seconds`,
		);
	}
}
