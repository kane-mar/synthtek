/**
 * Rotating file logger for synthtek
 * Writes logs to files with automatic rotation based on file size.
 */

import {
  createWriteStream,
  existsSync,
  createReadStream,
  mkdirSync,
} from 'node:fs';
import { readdir, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Logger, LogLevel, LOG_LEVELS, LogEntry, FileLoggerConfig } from './types.js';

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_MAX_FILES = 5;
const DEFAULT_COMPRESS = true;

function getLogFileName(serviceName: string, date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${serviceName}-${y}-${m}-${d}.log`;
}

function getCompressedFileName(serviceName: string, date: Date): string {
  return `${getLogFileName(serviceName, date)}.gz`;
}

function parseDateFromFilename(filename: string): Date | null {
  const match = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(
    parseInt(match[1], 10),
    parseInt(match[2], 10) - 1,
    parseInt(match[3], 10),
  );
}

export class RotatingFileLogger implements Logger {
  private level: LogLevel;
  private serviceName: string;
  private logDir: string;
  private maxFileSize: number;
  private maxFiles: number;
  private compress: boolean;
  private currentFile: string;
  private writeStream: ReturnType<typeof createWriteStream> | null = null;
  private buffer: string[] = [];
  private isRotating: boolean = false;

  constructor(config: FileLoggerConfig) {
    this.serviceName = config.serviceName;
    this.logDir = resolve(config.logDir);
    this.level = config.level ?? 'info';
    this.maxFileSize = config.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
    this.maxFiles = config.maxFiles ?? DEFAULT_MAX_FILES;
    this.compress = config.compress ?? DEFAULT_COMPRESS;
    this.currentFile = this.getLogFilePath();
  }

  private getLogFilePath(): string {
    return join(this.logDir, getLogFileName(this.serviceName, new Date()));
  }

  private ensureDir(): void {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  private async rotate(): Promise<void> {
    if (this.isRotating) return;
    this.isRotating = true;

    try {
      // Compress and remove old files
      const entries = await readdir(this.logDir);
      const logFiles: string[] = entries
        .filter((f: string) => f.startsWith(this.serviceName + '-') && f.endsWith('.log'))
        .map((f: string) => join(this.logDir, f))
        .filter((f: string) => parseDateFromFilename(f.split('/').pop()!) !== null);

      logFiles.sort((a: string, b: string) => {
        const da = parseDateFromFilename(a.split('/').pop()!)!;
        const db = parseDateFromFilename(b.split('/').pop()!)!;
        return da.getTime() - db.getTime();
      });

      for (let i = 0; i < logFiles.length; i++) {
        const file = logFiles[i];
        if (i >= this.maxFiles) {
          if (this.compress) {
            await this.compressFile(file);
          }
          await rm(file);
        }
      }

      // Close current stream and start a new one
      if (this.writeStream) {
        await new Promise<void>((resolve) => {
          this.writeStream!.end(() => resolve());
        });
      }

      this.currentFile = this.getLogFilePath();
      this.writeStream = createWriteStream(this.currentFile, { flags: 'a' });
    } finally {
      this.isRotating = false;
    }
  }

  private async compressFile(filePath: string): Promise<void> {
    const fileName = filePath.split('/').pop()!;
    const date = parseDateFromFilename(fileName);
    if (!date) return;

    const gzPath = join(this.logDir, getCompressedFileName(this.serviceName, date));
    try {
      const readStream = createReadStream(filePath);
      const writeStream = createWriteStream(gzPath);
      const gzip = createGzip();
      await pipeline(readStream, gzip, writeStream);
      await rm(filePath);
    } catch {
      // Compression failed — keep the uncompressed file
    }
  }

  private formatEntry(level: LogLevel, msg: string, meta?: unknown): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: msg,
      service: this.serviceName,
      meta: meta && typeof meta === 'object'
        ? (meta as Record<string, unknown>)
        : undefined,
    };
    return JSON.stringify(entry) + '\n';
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private async checkFileSize(): Promise<boolean> {
    try {
      const st = await stat(this.currentFile);
      return st.size >= this.maxFileSize;
    } catch {
      return false;
    }
  }

  private async flushStream(): Promise<void> {
    if (this.writeStream) {
      await new Promise<void>((resolve) => {
        this.writeStream!.end(() => resolve());
      });
      this.writeStream = createWriteStream(this.currentFile, { flags: 'a' });
    }
  }

  private async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0) return;

    const lines = this.buffer;
    this.buffer = [];

    // Check file size and rotate if needed
    const needsRotation = await this.checkFileSize();
    if (needsRotation) {
      await this.flushStream();
      await this.rotate();
    }

    if (!this.writeStream) {
      this.ensureDir();
      this.writeStream = createWriteStream(this.currentFile, { flags: 'a' });
    }

    for (const line of lines) {
      this.writeStream.write(line);
    }
  }

  debug(msg: string, meta?: unknown): void {
    if (!this.shouldLog('debug')) return;
    this.buffer.push(this.formatEntry('debug', msg, meta));
  }

  info(msg: string, meta?: unknown): void {
    if (!this.shouldLog('info')) return;
    this.buffer.push(this.formatEntry('info', msg, meta));
  }

  warn(msg: string, meta?: unknown): void {
    if (!this.shouldLog('warn')) return;
    this.buffer.push(this.formatEntry('warn', msg, meta));
  }

  error(msg: string, meta?: unknown): void {
    if (!this.shouldLog('error')) return;
    this.buffer.push(this.formatEntry('error', msg, meta));
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  async flush(): Promise<void> {
    await this.flushBuffer();
    if (this.writeStream) {
      await this.flushStream();
    }
  }

  async close(): Promise<void> {
    // Flush buffer without creating new streams
    if (this.buffer.length > 0) {
      const lines = this.buffer;
      this.buffer = [];
      if (this.writeStream) {
        for (const line of lines) {
          this.writeStream.write(line);
        }
      }
    }
    if (this.writeStream) {
      await new Promise<void>((resolve) => {
        this.writeStream!.end(() => resolve());
      });
      this.writeStream = null;
    }
  }
}
