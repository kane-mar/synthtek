/**
 * Plugin System Types
 * Defines the contract for all plugins in synthtek.
 */

import { EventEmitter } from 'node:events';

// ─── Manifest ───────────────────────────────────────────────────────────────

export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  /** Plugin names this plugin depends on (loaded before this one) */
  requires?: string[];
  /** JSON Schema draft-07 for config validation */
  configSchema?: Record<string, unknown>;
  /** Entry point module path (relative to plugin root) */
  main?: string;
}

// ─── Context ────────────────────────────────────────────────────────────────

export interface PluginContext {
  /** Plugin-specific configuration (validated) */
  config: Record<string, unknown>;
  /** Structured logger */
  logger: Logger;
  /** Emit an event to the global event bus */
  emit: (event: string, data: unknown) => void;
  /** Subscribe to events from the global event bus */
  on: (event: string, handler: (data: unknown) => void) => void;
  /** Plugin-specific event emitter (isolated) */
  events: EventEmitter;
}

// ─── Plugin Interface ───────────────────────────────────────────────────────

export interface Plugin {
  manifest: PluginManifest;
  context: PluginContext;
  /** Initialize the plugin (setup connections, load data, etc.) */
  init(): Promise<void>;
  /** Start the plugin (begin processing, listen, etc.) */
  run(): Promise<void>;
  /** Clean up resources */
  teardown(): Promise<void>;
}

// ─── Lifecycle States ───────────────────────────────────────────────────────

export type PluginStatus =
  | 'discovered'
  | 'loaded'
  | 'initialized'
  | 'running'
  | 'error'
  | 'teardown';

export interface PluginState {
  name: string;
  status: PluginStatus;
  error?: Error;
  loadedAt?: Date;
  startedAt?: Date;
  stoppedAt?: Date;
}

// ─── Discovery ──────────────────────────────────────────────────────────────

export interface DiscoveredPlugin {
  name: string;
  version: string;
  path: string;
  manifest: PluginManifest;
  packageJson?: Record<string, unknown>;
}

// ─── Loader ─────────────────────────────────────────────────────────────────

export interface PluginConfig {
  /** Directories to scan for plugins */
  directories: string[];
  /** Plugin name → config override */
  overrides: Record<string, Record<string, unknown>>;
  /** Whether to validate config against schema */
  validateConfig: boolean;
}

// ─── Manager ────────────────────────────────────────────────────────────────

export interface PluginManagerOptions {
  config: PluginConfig;
  globalLogger: Logger;
  globalEvents: EventEmitter;
}

export interface IPluginManager {
  /** Discover plugins in configured directories */
  discover(): Promise<DiscoveredPlugin[]>;
  /** Load plugins (validate config, resolve deps) */
  load(discovered: DiscoveredPlugin[]): Promise<Plugin[]>;
  /** Initialize all loaded plugins */
  init(plugins: Plugin[]): Promise<void>;
  /** Start all plugins */
  run(plugins: Plugin[]): Promise<void>;
  /** Stop all plugins gracefully */
  teardown(plugins: Plugin[]): Promise<void>;
  /** Get current state of all plugins */
  getState(): Map<string, PluginState>;
  /** Check if a plugin is running */
  isRunning(name: string): boolean;
}

// ─── Logger Interface (minimal, used by plugins) ────────────────────────────

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}
