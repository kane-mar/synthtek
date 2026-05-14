/**
 * Core type definitions for synthtek
 */

// ── Logger ──────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerConfig {
  level?: LogLevel;
  prefix?: string;
  timestamp?: boolean;
}

export interface Logger {
  debug(msg: string, meta?: unknown): void;
  info(msg: string, meta?: unknown): void;
  warn(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
  setLevel(level: LogLevel): void;
}

// ── File System ─────────────────────────────────────────────────────────────

export interface FileReadOptions {
  path: string;
  offset?: number;
  limit?: number;
  encoding?: BufferEncoding;
}

export interface FileReadResult {
  success: boolean;
  content: string;
  lines: string[];
  totalLines: number;
  offset: number;
  limit: number;
  truncated: boolean;
  error?: string;
}

export interface FileWriteOptions {
  path: string;
  content: string;
  createDirectories?: boolean;
  overwrite?: boolean;
}

export interface FileWriteResult {
  success: boolean;
  path: string;
  error?: string;
}

export interface FileEditOptions {
  path: string;
  oldText: string;
  newText: string;
  replaceAll?: boolean;
}

export interface FileEditResult {
  success: boolean;
  replacements: number;
  error?: string;
}

export interface FileStatResult {
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  mtime: Date;
}

export interface FileListEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
  isSymbolicLink: boolean;
}

export interface FileListResult {
  success: boolean;
  path: string;
  entries: FileListEntry[];
  error?: string;
}

export interface FileSystemService {
  read(options: FileReadOptions): Promise<FileReadResult>;
  write(options: FileWriteOptions): Promise<FileWriteResult>;
  edit(options: FileEditOptions): Promise<FileEditResult>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<FileStatResult | null>;
  list(path: string, recursive?: boolean): Promise<FileListResult>;
}

// ── Executor ────────────────────────────────────────────────────────────────

export interface ExecOptions {
  command: string;
  workingDir?: string;
  timeout?: number;
  maxOutputSize?: number;
  shell?: boolean;
  env?: Record<string, string>;
}

export interface ExecResult {
  success: boolean;
  command: string;
  stdout: string;
  stderr: string;
  code: number | null;
  signal: string | null;
  timedOut: boolean;
  truncated: boolean;
  duration: number;
  error?: string;
}

export interface ExecutorService {
  execute(options: ExecOptions): Promise<ExecResult>;
}

// ── Search ──────────────────────────────────────────────────────────────────

export interface GlobOptions {
  pattern: string;
  path?: string;
  headLimit?: number;
  offset?: number;
  entryType?: 'files' | 'dirs' | 'both';
}

export interface GlobResult {
  matches: string[];
  total: number;
  truncated: boolean;
}

export interface GrepOptions {
  pattern: string;
  path?: string;
  glob?: string;
  type?: string;
  caseInsensitive?: boolean;
  fixedStrings?: boolean;
  outputMode?: 'content' | 'files_with_matches' | 'count';
  contextBefore?: number;
  contextAfter?: number;
  headLimit?: number;
  offset?: number;
}

export interface GrepMatch {
  file: string;
  line: number;
  content: string;
  contextBefore?: string[];
  contextAfter?: string[];
}

export interface GrepResult {
  matches: GrepMatch[];
  filesWithMatches: string[];
  counts: Record<string, number>;
  totalMatches: number;
  truncated: boolean;
}

export interface SearcherService {
  glob(options: GlobOptions): Promise<GlobResult>;
  grep(options: GrepOptions): Promise<GrepResult>;
}

// ── Agent Spawner ───────────────────────────────────────────────────────────

export interface SpawnOptions {
  name?: string;
  task: string;
  workspace?: string;
  timeout?: number;
}

export interface SpawnedAgent {
  id: string;
  name: string;
  pid: number | null;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  task: string;
  output: string;
  error?: string;
  startTime: Date;
  endTime?: Date;
}

export interface SpawnerService {
  spawn(options: SpawnOptions): Promise<SpawnedAgent>;
}

// ── Message ─────────────────────────────────────────────────────────────────

export interface MessagePayload {
  content: string;
  channel?: string;
  prefix?: string;
  username?: string;
  filePath?: string;
}

export interface MessageResult {
  success: boolean;
  channel: string;
  messageId?: string;
  error?: string;
}

export interface MessengerService {
  send(payload: MessagePayload): Promise<MessageResult>;
}

// ── Config ──────────────────────────────────────────────────────────────────

export interface AgentConfig {
  name: string;
  version: string;
  workspace: string;
  logLevel: LogLevel;
  maxExecTimeout: number;
  maxExecRetries: number;
  spawnTimeout: number;
  messageChannel?: string;
  messageWebhook?: string;
}

export interface ConfigService {
  get<T extends keyof AgentConfig>(key: T): AgentConfig[T];
  set<T extends keyof AgentConfig>(key: T, value: AgentConfig[T]): void;
  getAll(): AgentConfig;
  load(configPath?: string): Promise<void>;
}
