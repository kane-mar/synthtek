/**
 * Logging service for synthtek
 * Combines file and stdout output with structured logging support.
 */

import { join, resolve } from "node:path";
import { PluginLoggerManager } from "./plugins.js";
import { RotatingFileLogger } from "./rotation.js";
import {
	LOG_LEVELS,
	type LogEntry,
	type Logger,
	type LoggingService,
	type LogLevel,
	type LogOutputFormat,
} from "./types.js";

// ── Console Logger ────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<LogLevel, string> = {
	debug: "\x1b[36m", // cyan
	info: "\x1b[32m", // green
	warn: "\x1b[33m", // yellow
	error: "\x1b[31m", // red
};

const RESET = "\x1b[0m";

class ConsoleLogger implements Logger {
	private level: LogLevel;
	private prefix: string;
	private format: LogOutputFormat;

	constructor(
		options: {
			prefix?: string;
			level?: LogLevel;
			format?: LogOutputFormat;
		} = {},
	) {
		this.prefix = options.prefix ?? "synthtek";
		this.level = options.level ?? "info";
		this.format = options.format ?? "text";
	}

	private formatEntry(level: LogLevel, msg: string, meta?: unknown): string {
		if (this.format === "json") {
			const entry: LogEntry = {
				timestamp: new Date().toISOString(),
				level,
				message: msg,
				service: this.prefix,
				meta:
					meta && typeof meta === "object"
						? (meta as Record<string, unknown>)
						: undefined,
			};
			return JSON.stringify(entry);
		}

		const parts: string[] = [];
		parts.push(new Date().toISOString());
		parts.push(`[${LEVEL_COLORS[level]}${level.toUpperCase()}${RESET}]`);
		parts.push(`[${this.prefix}]`);
		parts.push(msg);
		if (meta !== undefined) {
			parts.push(JSON.stringify(meta));
		}
		return parts.join(" ");
	}

	private shouldLog(level: LogLevel): boolean {
		return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
	}

	debug(msg: string, meta?: unknown): void {
		if (!this.shouldLog("debug")) return;
		console.log(this.formatEntry("debug", msg, meta));
	}

	info(msg: string, meta?: unknown): void {
		if (!this.shouldLog("info")) return;
		console.log(this.formatEntry("info", msg, meta));
	}

	warn(msg: string, meta?: unknown): void {
		if (!this.shouldLog("warn")) return;
		console.warn(this.formatEntry("warn", msg, meta));
	}

	error(msg: string, meta?: unknown): void {
		if (!this.shouldLog("error")) return;
		console.error(this.formatEntry("error", msg, meta));
	}

	setLevel(level: LogLevel): void {
		this.level = level;
	}

	getLevel(): LogLevel {
		return this.level;
	}
}

// ── Composite Logger ──────────────────────────────────────────────────────────

class CompositeLogger implements Logger {
	private loggers: Logger[];

	constructor(loggers: Logger[]) {
		this.loggers = loggers;
	}

	debug(msg: string, meta?: unknown): void {
		for (const logger of this.loggers) {
			logger.debug(msg, meta);
		}
	}

	info(msg: string, meta?: unknown): void {
		for (const logger of this.loggers) {
			logger.info(msg, meta);
		}
	}

	warn(msg: string, meta?: unknown): void {
		for (const logger of this.loggers) {
			logger.warn(msg, meta);
		}
	}

	error(msg: string, meta?: unknown): void {
		for (const logger of this.loggers) {
			logger.error(msg, meta);
		}
	}

	setLevel(level: LogLevel): void {
		for (const logger of this.loggers) {
			logger.setLevel(level);
		}
	}

	getLevel(): LogLevel {
		return this.loggers[0]?.getLevel() ?? "info";
	}
}

// ── Logging Service ───────────────────────────────────────────────────────────

export class LoggingServiceImpl implements LoggingService {
	private consoleLogger: ConsoleLogger;
	private fileLogger: RotatingFileLogger | null;
	private pluginManager: PluginLoggerManager;
	private cache: Map<string, Logger> = new Map();

	constructor(
		options: {
			logDir?: string;
			serviceName?: string;
			level?: LogLevel;
			format?: LogOutputFormat;
			enableFileLogging?: boolean;
		} = {},
	) {
		const logDir = resolve(options.logDir ?? "/tmp/logs/synthtek");
		const serviceName = options.serviceName ?? "synthtek";

		// Console logger
		this.consoleLogger = new ConsoleLogger({
			prefix: serviceName,
			level: options.level,
			format: options.format,
		});

		// File logger (optional)
		this.fileLogger = options.enableFileLogging
			? new RotatingFileLogger({
					logDir: join(logDir, "files"),
					serviceName,
					level: options.level,
					maxFileSize: 10 * 1024 * 1024,
					maxFiles: 5,
					compress: true,
				})
			: null;

		// Plugin logger manager
		this.pluginManager = new PluginLoggerManager({
			logDir: join(logDir, "plugins"),
			defaultLevel: options.level,
		});
	}

	getLogger(service: string, plugin?: string): Logger {
		const cacheKey = `${service}:${plugin ?? "none"}`;

		if (this.cache.has(cacheKey)) {
			return this.cache.get(cacheKey)!;
		}

		let logger: Logger;

		if (plugin) {
			// Plugin-specific logger: file isolation + console output
			const pluginLogger = this.pluginManager.getLogger(plugin);
			logger = new CompositeLogger([pluginLogger, this.consoleLogger]);
		} else {
			// Service-level logger: console + optional file
			const components: Logger[] = [this.consoleLogger];
			if (this.fileLogger) {
				const fileLogger = new RotatingFileLogger({
					logDir: join(
						(this.fileLogger as any).logDir ?? "/tmp/logs/synthtek/files",
					),
					serviceName: service,
					level: this.consoleLogger.getLevel(),
				});
				components.push(fileLogger);
			}
			logger = new CompositeLogger(components);
		}

		this.cache.set(cacheKey, logger);
		return logger;
	}

	setLevel(level: LogLevel): void {
		this.consoleLogger.setLevel(level);
		if (this.fileLogger) {
			this.fileLogger.setLevel(level);
		}
	}

	getLevel(): LogLevel {
		return this.consoleLogger.getLevel();
	}

	async flush(): Promise<void> {
		if (this.fileLogger) {
			await this.fileLogger.flush();
		}
		await this.pluginManager.flush();
	}

	async close(): Promise<void> {
		await this.flush();
		await this.pluginManager.close();
		this.cache.clear();
	}
}
