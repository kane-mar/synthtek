/**
 * Connection pool for LLM API connections
 * Manages a pool of reusable connections to reduce latency
 */

import type { PoolConfig, PoolConnection, PoolStats } from "./types.js";

const DEFAULT_POOL_CONFIG: PoolConfig = {
	maxConnections: 10,
	minConnections: 1,
	idleTimeoutMs: 60_000,
	acquireTimeoutMs: 10_000,
	maxRetries: 3,
};

let connectionCounter = 0;

export class ConnectionPool {
	private readonly _provider: string;
	private readonly _config: PoolConfig;
	private readonly _idleConnections: PoolConnection[] = [];
	private readonly _activeConnections: Map<string, PoolConnection> = new Map();
	private _totalAcquired = 0;
	private _totalReleased = 0;
	private _totalFailed = 0;
	private _destroyed = false;
	private _idleCheckTimer: ReturnType<typeof setInterval> | null = null;

	constructor(provider: string, config?: Partial<PoolConfig>) {
		this._provider = provider;
		this._config = { ...DEFAULT_POOL_CONFIG, ...config };
		this._startIdleCheck();
	}

	get provider(): string {
		return this._provider;
	}

	async acquire(): Promise<PoolConnection | null> {
		if (this._destroyed) return null;

		// Try to reuse an idle connection
		const idle = this._idleConnections.shift();
		if (idle) {
			return this._activate(idle);
		}

		// Check if we can create a new connection
		const totalConnections =
			this._activeConnections.size + this._idleConnections.length;
		if (totalConnections < this._config.maxConnections) {
			return this._createConnection();
		}

		// Pool exhausted — wait for a connection to be released
		return this._waitForConnection();
	}

	release(conn: PoolConnection): void {
		if (this._destroyed) {
			this._removeConnection(conn.id);
			return;
		}

		if (this._activeConnections.has(conn.id)) {
			this._activeConnections.delete(conn.id);
			conn.inUse = false;
			conn.lastUsedAt = Date.now();
			this._idleConnections.push(conn);
			this._totalReleased++;
		}
	}

	stats(): PoolStats {
		return {
			activeConnections: this._activeConnections.size,
			idleConnections: this._idleConnections.length,
			totalAcquired: this._totalAcquired,
			totalReleased: this._totalReleased,
			totalFailed: this._totalFailed,
			waitingRequests: 0,
		};
	}

	async destroy(): Promise<void> {
		this._destroyed = true;

		if (this._idleCheckTimer) {
			clearInterval(this._idleCheckTimer);
			this._idleCheckTimer = null;
		}

		// Close all idle connections
		for (const conn of this._idleConnections) {
			this._removeConnection(conn.id);
		}
		this._idleConnections.length = 0;

		// Close all active connections
		for (const conn of this._activeConnections.values()) {
			this._removeConnection(conn.id);
		}
		this._activeConnections.clear();
	}

	// ── Private ──────────────────────────────────────────────────────────────

	private _createConnection(): PoolConnection {
		connectionCounter++;
		const conn: PoolConnection = {
			id: `conn_${this._provider}_${connectionCounter}`,
			provider: this._provider,
			createdAt: Date.now(),
			lastUsedAt: Date.now(),
			inUse: false,
		};
		return this._activate(conn);
	}

	private _activate(conn: PoolConnection): PoolConnection {
		conn.inUse = true;
		conn.lastUsedAt = Date.now();
		this._activeConnections.set(conn.id, conn);
		this._totalAcquired++;
		return conn;
	}

	private _removeConnection(id: string): void {
		this._activeConnections.delete(id);
		const idx = this._idleConnections.findIndex((c) => c.id === id);
		if (idx !== -1) {
			this._idleConnections.splice(idx, 1);
		}
	}

	private async _waitForConnection(): Promise<PoolConnection | null> {
		const deadline = Date.now() + this._config.acquireTimeoutMs;

		while (Date.now() < deadline) {
			// Check for an idle connection
			const idle = this._idleConnections.shift();
			if (idle) {
				return this._activate(idle);
			}

			// Check if a slot opened up
			const totalConnections =
				this._activeConnections.size + this._idleConnections.length;
			if (totalConnections < this._config.maxConnections) {
				return this._createConnection();
			}

			// Wait a bit before retrying
			await new Promise((r) => setTimeout(r, 50));
		}

		this._totalFailed++;
		return null;
	}

	private _startIdleCheck(): void {
		this._idleCheckTimer = setInterval(
			() => {
				if (this._destroyed) return;

				const now = Date.now();
				const cutoff = now - this._config.idleTimeoutMs;

				for (let i = this._idleConnections.length - 1; i >= 0; i--) {
					if (this._idleConnections[i].lastUsedAt <= cutoff) {
						this._idleConnections.splice(i, 1);
					}
				}
			},
			Math.min(this._config.idleTimeoutMs, 5_000),
		);
		if (this._idleCheckTimer?.unref) {
			this._idleCheckTimer.unref();
		}
	}
}
