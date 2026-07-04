/**
 * Lightweight metrics collector for the WebUI server.
 *
 * Tracks request counts, latencies, and error rates per route.
 * Serves as a thin observability layer without external dependencies.
 * Compatible with OpenTelemetry-style span data if needed later.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface RouteMetrics {
	/** Total requests to this route */
	requests: number;
	/** Successful responses (2xx) */
	successes: number;
	/** Client errors (4xx) */
	clientErrors: number;
	/** Server errors (5xx) */
	serverErrors: number;
	/** Total duration in milliseconds */
	totalDurationMs: number;
	/** Average duration in milliseconds */
	averageLatencyMs: number;
	/** Last request timestamp */
	lastRequestAt: string | null;
}

export interface MetricsSnapshot {
	/** Per-route metrics keyed by method:path */
	routes: Record<string, RouteMetrics>;
	/** Total requests across all routes */
	totalRequests: number;
	/** Server uptime in seconds */
	uptime: number;
	/** Timestamp of the snapshot */
	timestamp: string;
	/** Memory usage (process.memoryUsage()) */
	memory: {
		rss: number;
		heapTotal: number;
		heapUsed: number;
	};
}

// ── MetricsCollector ────────────────────────────────────────────────────────

export class MetricsCollector {
	private routes: Map<string, RouteMetrics> = new Map();
	private readonly startTime: number = Date.now();

	/** Record a request to a specific route */
	recordRequest(
		method: string,
		path: string,
		statusCode: number,
		durationMs: number,
	): void {
		const key = `${method}:${path}`;
		let metrics = this.routes.get(key);
		if (!metrics) {
			metrics = {
				requests: 0,
				successes: 0,
				clientErrors: 0,
				serverErrors: 0,
				totalDurationMs: 0,
				averageLatencyMs: 0,
				lastRequestAt: null,
			};
			this.routes.set(key, metrics);
		}

		metrics.requests++;
		metrics.totalDurationMs += durationMs;
		metrics.averageLatencyMs = Math.round(
			metrics.totalDurationMs / metrics.requests,
		);
		metrics.lastRequestAt = new Date().toISOString();

		if (statusCode >= 200 && statusCode < 300) {
			metrics.successes++;
		} else if (statusCode >= 400 && statusCode < 500) {
			metrics.clientErrors++;
		} else if (statusCode >= 500) {
			metrics.serverErrors++;
		}
	}

	/** Get a snapshot of all metrics */
	getSnapshot(): MetricsSnapshot {
		const mem = process.memoryUsage();
		const routes: Record<string, RouteMetrics> = {};
		let totalRequests = 0;

		for (const [key, metrics] of this.routes) {
			routes[key] = { ...metrics };
			totalRequests += metrics.requests;
		}

		return {
			routes,
			totalRequests,
			uptime: Math.floor((Date.now() - this.startTime) / 1000),
			timestamp: new Date().toISOString(),
			memory: {
				rss: mem.rss,
				heapTotal: mem.heapTotal,
				heapUsed: mem.heapUsed,
			},
		};
	}

	/** Reset all metrics */
	reset(): void {
		this.routes.clear();
	}
}
