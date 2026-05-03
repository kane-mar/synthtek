/**
 * Logging type definitions for synthtek
 */

// ── Log Levels ────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export const LOG_LEVEL_NAMES: LogLevel[] = ['debug', 'info', 'warn', 'error'];

// ── Logger Interface ──────────────────────────────────────────────────────────

export interface Logger {
  debug(msg: string, meta?: unknown): void;
  info(msg: string, meta?: unknown): void;
  warn(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
}

// ── Structured Log Entry ──────────────────────────────────────────────────────

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  plugin?: string;
  meta?: Record<string, unknown>;
}

// ── File Logger Config ────────────────────────────────────────────────────────

export interface FileLoggerConfig {
  logDir: string;
  serviceName: string;
  level?: LogLevel;
  maxFileSize?: number; // bytes, default 10MB
  maxFiles?: number; // default 5
  compress?: boolean; // default true
  jsonFormat?: boolean; // default true
}

// ── Rotation Config ───────────────────────────────────────────────────────────

export interface RotationConfig {
  maxFileSize: number;
  maxFiles: number;
  compress: boolean;
}

// ── Plugin Logger Config ──────────────────────────────────────────────────────

export interface PluginLoggerConfig {
  pluginName: string;
  logDir: string;
  level?: LogLevel;
  maxFileSize?: number;
  maxFiles?: number;
  compress?: boolean;
}

// ── Logging Service Interface ─────────────────────────────────────────────────

export interface LoggingService {
  getLogger(service: string, plugin?: string): Logger;
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
  flush(): Promise<void>;
  close(): Promise<void>;
}

// ── Log Output Format ─────────────────────────────────────────────────────────

export type LogOutputFormat = 'json' | 'text';
