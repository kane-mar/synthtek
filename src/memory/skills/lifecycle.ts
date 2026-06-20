/**
 * Memory Lifecycle Skill
 *
 * Manages memory lifecycle states: active, idle, archived, degraded.
 * Handles auto-transition based on usage patterns.
 */

import type { LongTermMemoryService } from "../types.js";
import type {
	LifecycleState,
	MemoryLifecycleConfig,
	MemorySkill,
} from "./types.js";

const DEFAULT_CONFIG: Required<MemoryLifecycleConfig> = {
	dataDir: "./memory/skills/lifecycle",
	enabled: true,
	idleTimeout: 86400, // 24 hours
	autoArchive: false,
};

export class MemoryLifecycleSkill implements MemorySkill {
	public name = "memory-lifecycle";
	private memory: LongTermMemoryService | null = null;
	private config: Required<MemoryLifecycleConfig>;
	private state: LifecycleState = "active";
	private lastAccessTime: Date = new Date();
	private intervalId: ReturnType<typeof setInterval> | null = null;

	constructor(config?: Partial<MemoryLifecycleConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	async init(memory: LongTermMemoryService): Promise<void> {
		this.memory = memory;
		this.state = "active";
		this.lastAccessTime = new Date();

		if (this.config.enabled) {
			this.startMonitoring();
		}
	}

	async shutdown(): Promise<void> {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	/**
	 * Get current lifecycle state.
	 */
	getState(): LifecycleState {
		return this.state;
	}

	/**
	 * Record an access event (keeps memory active).
	 */
	recordAccess(): void {
		this.lastAccessTime = new Date();
		if (this.state === "idle") {
			this.state = "active";
		}
	}

	/**
	 * Force transition to a specific state.
	 */
	async transitionTo(state: LifecycleState): Promise<void> {
		this.state = state;

		if (state === "archived" && this.memory) {
			await this.memory.save();
		}
	}

	/**
	 * Check if memory is healthy.
	 */
	async healthCheck(): Promise<{
		state: LifecycleState;
		idleTime: number;
		entryCount: number;
		storageSize: number;
		isHealthy: boolean;
	}> {
		if (!this.memory) {
			return {
				state: this.state,
				idleTime: Date.now() - this.lastAccessTime.getTime(),
				entryCount: 0,
				storageSize: 0,
				isHealthy: false,
			};
		}

		const stats = await this.memory.getStats();
		const idleTime = Date.now() - this.lastAccessTime.getTime();

		return {
			state: this.state,
			idleTime,
			entryCount: stats.totalEntries,
			storageSize: stats.storageSize,
			isHealthy: this.state !== "degraded",
		};
	}

	// ── Private helpers ──

	private startMonitoring(): void {
		this.intervalId = setInterval(async () => {
			const idleMs = Date.now() - this.lastAccessTime.getTime();
			const idleSeconds = idleMs / 1000;

			// Transition to idle if no access for timeout period
			if (this.state === "active" && idleSeconds > this.config.idleTimeout) {
				this.state = "idle";
			}

			// Auto-archive if configured and idle for too long
			if (
				this.config.autoArchive &&
				this.state === "idle" &&
				idleSeconds > this.config.idleTimeout * 2
			) {
				this.state = "archived";
			}

			// Check for degraded state (too many entries)
			if (this.memory) {
				try {
					const stats = await this.memory.getStats();
					if (stats.totalEntries > 50000) {
						this.state = "degraded";
					}
				} catch {
					// Ignore errors during monitoring
				}
			}
		}, 60000); // Check every minute
	}
}
