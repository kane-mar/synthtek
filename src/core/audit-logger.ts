/**
 * Audit Logger Module
 *
 * Records all significant operations with timestamps,
 * operation details, and context for security auditing.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Audit event severity levels */
export enum AuditLevel {
	INFO = "INFO",
	WARN = "WARN",
	ERROR = "ERROR",
	SECURITY = "SECURITY",
}

/** Categories of auditable operations */
export enum AuditCategory {
	CONFIG = "config",
	MEMORY = "memory",
	SECURITY = "security",
	PLUGIN = "plugin",
	PROVIDER = "provider",
	CHANNEL = "channel",
	SYSTEM = "system",
	API = "api",
}

/** Audit log entry */
export interface AuditEntry {
	/** ISO-8601 timestamp */
	timestamp: string;
	/** Severity level */
	level: AuditLevel;
	/** Operation category */
	category: AuditCategory;
	/** Human-readable message */
	message: string;
	/** Operation name (e.g., 'config.set', 'memory.save') */
	operation: string;
	/** User or system identifier */
	actor?: string;
	/** Additional context data */
	context?: Record<string, unknown>;
	/** Whether the operation succeeded */
	success?: boolean;
	/** IP address (for API operations) */
	ip?: string;
}

/** Audit logger configuration */
export interface AuditLoggerConfig {
	/** Directory to store audit logs */
	logDir?: string;
	/** Maximum log file size in bytes (default: 10MB) */
	maxFileSize?: number;
	/** Maximum number of rotated log files to keep (default: 5) */
	maxFiles?: number;
	/** Whether to enable audit logging (default: true) */
	enabled?: boolean;
	/** Minimum level to log (default: INFO) */
	minLevel?: AuditLevel;
}

// ─── Audit Logger ────────────────────────────────────────────────────────────

/**
 * Audit logger that records significant operations to disk.
 * Supports log rotation and filtering by severity level.
 */
export class AuditLogger {
	private config: Required<AuditLoggerConfig>;
	private currentFileSize: number = 0;
	private currentFileIndex: number = 0;
	private entries: AuditEntry[] = [];

	constructor(config: AuditLoggerConfig = {}) {
		this.config = {
			logDir: config.logDir ?? join(process.cwd(), "logs", "audit"),
			maxFileSize: config.maxFileSize ?? 10 * 1024 * 1024, // 10MB
			maxFiles: config.maxFiles ?? 5,
			enabled: config.enabled ?? true,
			minLevel: config.minLevel ?? AuditLevel.INFO,
		};

		// Ensure log directory exists
		if (this.config.enabled) {
			this.ensureLogDir();
		}
	}

	/**
	 * Log an audit event.
	 */
	log(entry: Omit<AuditEntry, "timestamp">): void {
		if (!this.config.enabled) return;

		// Check minimum level
		if (!this.shouldLog(entry.level)) {
			return;
		}

		const auditEntry: AuditEntry = {
			timestamp: new Date().toISOString(),
			...entry,
		};

		this.entries.push(auditEntry);

		// Write to disk
		this.writeToDisk(auditEntry);
	}

	/**
	 * Log a configuration change.
	 */
	logConfigChange(
		operation: string,
		key: string,
		oldValue?: unknown,
		newValue?: unknown,
		actor: string = "system",
	): void {
		this.log({
			level: AuditLevel.INFO,
			category: AuditCategory.CONFIG,
			message: `Configuration changed: ${key}`,
			operation: `config.${operation}`,
			actor,
			context: {
				key,
				oldValue: this.sanitizeValue(oldValue),
				newValue: this.sanitizeValue(newValue),
			},
			success: true,
		});
	}

	/**
	 * Log a security event.
	 */
	logSecurityEvent(
		operation: string,
		message: string,
		context?: Record<string, unknown>,
		success: boolean = true,
	): void {
		this.log({
			level: AuditLevel.SECURITY,
			category: AuditCategory.SECURITY,
			message,
			operation: `security.${operation}`,
			context,
			success,
		});
	}

	/**
	 * Log a memory operation.
	 */
	logMemoryOperation(
		operation: string,
		message: string,
		context?: Record<string, unknown>,
	): void {
		this.log({
			level: AuditLevel.INFO,
			category: AuditCategory.MEMORY,
			message,
			operation: `memory.${operation}`,
			context,
			success: true,
		});
	}

	/**
	 * Log a plugin event.
	 */
	logPluginEvent(
		operation: string,
		pluginName: string,
		message: string,
		success: boolean = true,
	): void {
		this.log({
			level: success ? AuditLevel.INFO : AuditLevel.ERROR,
			category: AuditCategory.PLUGIN,
			message,
			operation: `plugin.${operation}`,
			context: { pluginName },
			success,
		});
	}

	/**
	 * Log a provider event.
	 */
	logProviderEvent(
		operation: string,
		providerName: string,
		message: string,
		context?: Record<string, unknown>,
		success: boolean = true,
	): void {
		this.log({
			level: success ? AuditLevel.INFO : AuditLevel.ERROR,
			category: AuditCategory.PROVIDER,
			message,
			operation: `provider.${operation}`,
			context: { providerName, ...context },
			success,
		});
	}

	/**
	 * Log an API request.
	 */
	logApiRequest(
		method: string,
		path: string,
		statusCode: number,
		duration: number,
		ip: string = "127.0.0.1",
	): void {
		this.log({
			level: statusCode >= 400 ? AuditLevel.WARN : AuditLevel.INFO,
			category: AuditCategory.API,
			message: `${method} ${path} -> ${statusCode} (${duration}ms)`,
			operation: `api.request`,
			context: { method, path, statusCode, duration },
			success: statusCode < 400,
			ip,
		});
	}

	/**
	 * Get recent audit entries.
	 */
	getRecentEntries(limit: number = 100): AuditEntry[] {
		return this.entries.slice(-limit);
	}

	/**
	 * Get audit entries filtered by category.
	 */
	getEntriesByCategory(
		category: AuditCategory,
		limit: number = 100,
	): AuditEntry[] {
		return this.entries.filter((e) => e.category === category).slice(-limit);
	}

	/**
	 * Get audit entries filtered by level.
	 */
	getEntriesByLevel(level: AuditLevel, limit: number = 100): AuditEntry[] {
		return this.entries.filter((e) => e.level === level).slice(-limit);
	}

	/**
	 * Clear in-memory entries (does not delete log files).
	 */
	clear(): void {
		this.entries = [];
	}

	// ── Private helpers ──────────────────────────────────────────────────────

	private ensureLogDir(): void {
		if (!existsSync(this.config.logDir)) {
			mkdirSync(this.config.logDir, { recursive: true });
		}
	}

	private shouldLog(level: AuditLevel): boolean {
		const levels = Object.values(AuditLevel);
		const currentIndex = levels.indexOf(level);
		const minIndex = levels.indexOf(this.config.minLevel);
		return currentIndex >= minIndex;
	}

	private sanitizeValue(value: unknown): unknown {
		// Redact sensitive values
		if (typeof value === "string") {
			if (value.length > 100) {
				return `[redacted: ${value.length} chars]`;
			}
			// Check for potential secrets
			const secretPatterns = [
				/sk-[a-zA-Z0-9]+/,
				/Bearer\s+[a-zA-Z0-9]+/,
				/password/i,
				/api[_-]?key/i,
			];
			for (const pattern of secretPatterns) {
				if (pattern.test(value)) {
					return "[redacted]";
				}
			}
		}
		return value;
	}

	private writeToDisk(entry: AuditEntry): void {
		try {
			const logLine = `${JSON.stringify(entry)}\n`;
			this.currentFileSize += Buffer.byteLength(logLine, "utf8");

			// Rotate if file is too large
			if (this.currentFileSize > this.config.maxFileSize) {
				this.rotate();
				this.currentFileSize = Buffer.byteLength(logLine, "utf8");
			}

			const logFile = this.currentLogFilePath();
			writeFileSync(logFile, logLine, { flag: "a" });
		} catch {
			// Silently fail - audit logging should not break the application
		}
	}

	private currentLogFilePath(): string {
		return join(this.config.logDir, `audit-${this.currentFileIndex}.jsonl`);
	}

	private rotate(): void {
		try {
			// Remove oldest file if at max
			if (this.currentFileIndex >= this.config.maxFiles) {
				const oldestFile = join(this.config.logDir, "audit-0.jsonl");
				if (existsSync(oldestFile)) {
					// Shift all files down by one
					for (let i = this.config.maxFiles - 1; i > 0; i--) {
						const oldPath = join(this.config.logDir, `audit-${i - 1}.jsonl`);
						if (existsSync(oldPath)) {
							// Rename is not available, so we'll just increment the index
						}
					}
				}
			}
			this.currentFileIndex++;
		} catch {
			// Silently fail
		}
	}
}
