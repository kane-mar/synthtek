/**
 * Simple logger implementation
 */

import { Logger, LogLevel, LoggerConfig } from './types.js';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m',   // cyan
  info: '\x1b[32m',    // green
  warn: '\x1b[33m',    // yellow
  error: '\x1b[31m',   // red
};

const RESET = '\x1b[0m';

export class SimpleLogger implements Logger {
  private level: LogLevel;
  private prefix: string;
  private timestamp: boolean;

  constructor(config: LoggerConfig = {}) {
    this.level = config.level ?? 'info';
    this.prefix = config.prefix ?? 'synthtek';
    this.timestamp = config.timestamp ?? true;
  }

  private format(level: LogLevel, msg: string, meta?: unknown): string {
    const parts: string[] = [];

    if (this.timestamp) {
      parts.push(new Date().toISOString());
    }

    parts.push(`[${LEVEL_COLORS[level]}${level.toUpperCase()}${RESET}]`);
    parts.push(`[${this.prefix}]`);
    parts.push(msg);

    if (meta !== undefined) {
      parts.push(JSON.stringify(meta));
    }

    return parts.join(' ');
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.level];
  }

  debug(msg: string, meta?: unknown): void {
    if (!this.shouldLog('debug')) return;
    console.log(this.format('debug', msg, meta));
  }

  info(msg: string, meta?: unknown): void {
    if (!this.shouldLog('info')) return;
    console.log(this.format('info', msg, meta));
  }

  warn(msg: string, meta?: unknown): void {
    if (!this.shouldLog('warn')) return;
    console.warn(this.format('warn', msg, meta));
  }

  error(msg: string, meta?: unknown): void {
    if (!this.shouldLog('error')) return;
    console.error(this.format('error', msg, meta));
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}
