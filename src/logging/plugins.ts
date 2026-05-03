/**
 * Per-plugin log isolation for synthtek
 * Manages separate loggers for each plugin.
 */

import { join, resolve } from 'node:path';
import { Logger, LogLevel, FileLoggerConfig } from './types.js';
import { RotatingFileLogger } from './rotation.js';

export class PluginLogger implements Logger {
  private logger: Logger;
  private pluginName: string;

  constructor(logger: Logger, pluginName: string) {
    this.logger = logger;
    this.pluginName = pluginName;
  }

  debug(msg: string, meta?: unknown): void {
    this.logger.debug(msg, { plugin: this.pluginName, ...(meta as Record<string, unknown> || {}) });
  }

  info(msg: string, meta?: unknown): void {
    this.logger.info(msg, { plugin: this.pluginName, ...(meta as Record<string, unknown> || {}) });
  }

  warn(msg: string, meta?: unknown): void {
    this.logger.warn(msg, { plugin: this.pluginName, ...(meta as Record<string, unknown> || {}) });
  }

  error(msg: string, meta?: unknown): void {
    this.logger.error(msg, { plugin: this.pluginName, ...(meta as Record<string, unknown> || {}) });
  }

  setLevel(level: LogLevel): void {
    this.logger.setLevel(level);
  }

  getLevel(): LogLevel {
    return this.logger.getLevel();
  }

  getPluginName(): string {
    return this.pluginName;
  }
}

export class PluginLoggerManager {
  private loggers: Map<string, PluginLogger> = new Map();
  private logDir: string;
  private defaultLevel: LogLevel;

  constructor(options: { logDir: string; defaultLevel?: LogLevel } = { logDir: '/tmp/logs' }) {
    this.logDir = resolve(options.logDir);
    this.defaultLevel = options.defaultLevel ?? 'info';
  }

  getLogger(pluginName: string, level?: LogLevel): PluginLogger {
    if (this.loggers.has(pluginName)) {
      return this.loggers.get(pluginName)!;
    }

    const fileConfig: FileLoggerConfig = {
      logDir: join(this.logDir, 'plugins'),
      serviceName: `plugin-${pluginName}`,
      level: level ?? this.defaultLevel,
      maxFileSize: 10 * 1024 * 1024,
      maxFiles: 5,
      compress: true,
    };

    const fileLogger = new RotatingFileLogger(fileConfig);
    const pluginLogger = new PluginLogger(fileLogger, pluginName);
    this.loggers.set(pluginName, pluginLogger);
    return pluginLogger;
  }

  setLevel(pluginName: string, level: LogLevel): void {
    const logger = this.loggers.get(pluginName);
    if (logger) {
      logger.setLevel(level);
    }
  }

  getLevel(pluginName: string): LogLevel | undefined {
    const logger = this.loggers.get(pluginName);
    return logger?.getLevel();
  }

  getAllLoggers(): Map<string, PluginLogger> {
    return new Map(this.loggers);
  }

  async flush(): Promise<void> {
    for (const logger of this.loggers.values()) {
      // Access the underlying logger to flush
      const underlying = (logger as unknown as { logger: { flush: () => Promise<void> } }).logger;
      if (underlying && typeof underlying.flush === 'function') {
        await underlying.flush();
      }
    }
  }

  async close(): Promise<void> {
    await this.flush();
    this.loggers.clear();
  }
}
