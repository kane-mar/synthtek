/**
 * Configuration hot-reload — watch for config file changes and reload automatically
 */

import { type FSWatcher, watch } from "node:fs";
import { resolve } from "node:path";
import type { ConfigLoader } from "./loader.js";
import type { AgentConfig } from "./schema.js";

export type ConfigChangeHandler = (
	oldConfig: AgentConfig,
	newConfig: AgentConfig,
) => void;

export interface HotReloadConfig {
	/** Polling interval in milliseconds (default: 5000) */
	interval?: number;
	/** Config file path to watch (optional — if omitted, watches all known config files) */
	configPath?: string;
	/** Whether to watch for config file changes (default: true) */
	enabled?: boolean;
}

export interface HotReloadManager {
	start(configLoader: ConfigLoader, onChange: ConfigChangeHandler): void;
	stop(): void;
	isRunning(): boolean;
	getConfigPath(): string | null;
}

export class HotReloadManagerImpl implements HotReloadManager {
	private watcher: FSWatcher | null = null;
	private pollTimer: ReturnType<typeof setInterval> | null = null;
	private running: boolean = false;
	private configLoader: ConfigLoader | null = null;
	private onChange: ConfigChangeHandler | null = null;
	// private lastConfig: AgentConfig | null = null;
	private interval: number;
	private configPath: string | null = null;

	constructor(config: HotReloadConfig = {}) {
		this.interval = config.interval ?? 5000;
		this.configPath = config.configPath ?? null;
	}

	start(configLoader: ConfigLoader, onChange: ConfigChangeHandler): void {
		if (this.running) return;

		this.configLoader = configLoader;
		this.onChange = onChange;
		this.running = true;

		// Get the config file path
		const configPath = configLoader.getConfigPath();
		if (configPath) {
			this.configPath = configPath;
			this.watchFile(configPath);
		} else {
			// No config file — fall back to polling
			this.poll();
		}
	}

	stop(): void {
		this.running = false;

		if (this.watcher) {
			this.watcher.close();
			this.watcher = null;
		}

		if (this.pollTimer) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
	}

	isRunning(): boolean {
		return this.running;
	}

	getConfigPath(): string | null {
		return this.configPath;
	}

	private watchFile(filePath: string): void {
		const resolvedPath = resolve(filePath);

		try {
			this.watcher = watch(resolvedPath, () => {
				if (!this.running || !this.configLoader || !this.onChange) return;

				const oldConfig = this.configLoader.getConfig();
				const newConfig = this.configLoader.reload();

				if (this.configsDiffer(oldConfig, newConfig)) {
					this.onChange(oldConfig, newConfig);
				}
			});
		} catch {
			// File watching failed — fall back to polling
			this.poll();
		}
	}

	private poll(): void {
		if (!this.configLoader || !this.onChange) return;
		const configLoader = this.configLoader;

		this.pollTimer = setInterval(() => {
			if (!this.running) return;

			const oldConfig = configLoader.getConfig();
			const newConfig = configLoader.reload();

			if (this.configsDiffer(oldConfig, newConfig)) {
				this.onChange?.(oldConfig, newConfig);
			}
		}, this.interval);
	}

	private configsDiffer(a: AgentConfig, b: AgentConfig): boolean {
		// Simple deep comparison for config differences
		const aStr = JSON.stringify(a);
		const bStr = JSON.stringify(b);
		return aStr !== bStr;
	}
}
