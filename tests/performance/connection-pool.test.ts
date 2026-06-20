/**
 * Tests for ConnectionPool (LLM API connection pooling)
 */

import { equal, ok } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import { ConnectionPool } from "../../src/performance/connection-pool.js";
import type {
	PoolConfig,
	PoolConnection,
	PoolStats,
} from "../../src/performance/types.js";

const defaultConfig: PoolConfig = {
	maxConnections: 5,
	minConnections: 1,
	idleTimeoutMs: 30_000,
	acquireTimeoutMs: 5_000,
	maxRetries: 3,
};

describe("ConnectionPool", () => {
	let pool: ConnectionPool;

	beforeEach(() => {
		pool = new ConnectionPool("openai", defaultConfig);
	});

	afterEach(async () => {
		await pool.destroy();
	});

	describe("initialization", () => {
		it("creates with the configured provider name", () => {
			equal(pool.provider, "openai");
		});

		it("starts with zero active connections", () => {
			const stats = pool.stats();
			equal(stats.activeConnections, 0);
		});

		it("tracks total acquired and released counts", () => {
			const stats = pool.stats();
			equal(stats.totalAcquired, 0);
			equal(stats.totalReleased, 0);
		});
	});

	describe("acquire and release", () => {
		it("acquires a connection from the pool", async () => {
			const conn = await pool.acquire();

			ok(conn !== null);
			ok(conn.id.length > 0);
			equal(conn.provider, "openai");

			const stats = pool.stats();
			equal(stats.activeConnections, 1);
			equal(stats.totalAcquired, 1);
		});

		it("releases a connection back to the pool", async () => {
			const conn = await pool.acquire();
			ok(conn !== null);

			pool.release(conn);

			const stats = pool.stats();
			equal(stats.activeConnections, 0);
			equal(stats.totalReleased, 1);
		});

		it("reuses released connections", async () => {
			const conn1 = await pool.acquire();
			ok(conn1 !== null);
			const id1 = conn1.id;

			pool.release(conn1);

			const conn2 = await pool.acquire();
			ok(conn2 !== null);
			equal(conn2.id, id1);
		});

		it("creates new connections when pool is empty", async () => {
			const conn1 = await pool.acquire();
			const conn2 = await pool.acquire();

			ok(conn1 !== null);
			ok(conn2 !== null);
			notEqual(conn1.id, conn2.id);

			const stats = pool.stats();
			equal(stats.activeConnections, 2);

			pool.release(conn1);
			pool.release(conn2);
		});

		it("respects maxConnections limit", async () => {
			const conns: PoolConnection[] = [];

			for (let i = 0; i < defaultConfig.maxConnections; i++) {
				const conn = await pool.acquire();
				ok(conn !== null);
				conns.push(conn);
			}

			const stats = pool.stats();
			equal(stats.activeConnections, defaultConfig.maxConnections);

			// Next acquire should return null (pool exhausted)
			const exhausted = await pool.acquire();
			equal(exhausted, null);

			for (const conn of conns) {
				pool.release(conn);
			}
		});

		it("returns null when acquire times out", async () => {
			const tightPool = new ConnectionPool("openai", {
				...defaultConfig,
				maxConnections: 1,
				acquireTimeoutMs: 100,
			});

			const conn = await tightPool.acquire();
			ok(conn !== null);

			// Pool is full, next acquire should timeout
			const timedOut = await tightPool.acquire();
			equal(timedOut, null);

			tightPool.release(conn);
			await tightPool.destroy();
		});
	});

	describe("idle timeout", () => {
		it("closes idle connections after timeout", async () => {
			const shortPool = new ConnectionPool("openai", {
				...defaultConfig,
				idleTimeoutMs: 200,
			});

			const conn = await shortPool.acquire();
			ok(conn !== null);
			shortPool.release(conn);

			// Wait for idle timeout (interval fires every idleTimeoutMs, need 2 cycles)
			await new Promise((r) => setTimeout(r, 500));

			const stats = shortPool.stats();
			equal(stats.idleConnections, 0);

			await shortPool.destroy();
		});
	});

	describe("stats", () => {
		it("reports accurate statistics", async () => {
			const conn = await pool.acquire();
			ok(conn !== null);

			const stats: PoolStats = pool.stats();
			equal(stats.activeConnections, 1);
			equal(stats.totalAcquired, 1);
			equal(stats.totalReleased, 0);
			equal(stats.totalFailed, 0);
		});
	});

	describe("destroy", () => {
		it("closes all connections on destroy", async () => {
			const connA = await pool.acquire();
			const connB = await pool.acquire();

			await pool.destroy();

			ok(connA && connB, "connections were acquired");
			const stats = pool.stats();
			equal(stats.activeConnections, 0);
			equal(stats.idleConnections, 0);
		});
	});
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function notEqual(a: unknown, b: unknown): void {
	if (a === b) {
		throw new AssertionError(`Expected ${a} to not equal ${b}`);
	}
}

class AssertionError extends Error {
	name = "AssertionError";
}
