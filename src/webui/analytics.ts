/**
 * WebUI Analytics Tracker
 *
 * Collects and aggregates analytics data from across the system:
 * request volume, token usage, latency, errors, provider costs,
 * channel usage, and session activity.
 */

import type {
	AnalyticsSummary,
	ErrorRecord,
	LLMRequestRecord,
} from "./types.js";

let idCounter = 0;
function nextId(): string {
	return `a_${++idCounter}_${Date.now()}`;
}

interface TrackRequestInput {
	provider: string;
	model: string;
	promptTokens: number;
	completionTokens: number;
	latencyMs: number;
	cost: number;
	success: boolean;
	endpoint?: string;
	errorMessage?: string;
}

interface TrackErrorInput {
	type: ErrorRecord["type"];
	source: string;
	message: string;
}

export class AnalyticsTracker {
	private requests: LLMRequestRecord[] = [];
	private errors: ErrorRecord[] = [];
	private channelUsage: Map<string, { sent: number; received: number }> =
		new Map();
	private requestCountByEndpoint: Map<string, number> = new Map();

	trackRequest(input: TrackRequestInput): void {
		const record: LLMRequestRecord = {
			id: nextId(),
			provider: input.provider,
			model: input.model,
			promptTokens: input.promptTokens,
			completionTokens: input.completionTokens,
			totalTokens: input.promptTokens + input.completionTokens,
			latencyMs: input.latencyMs,
			cost: input.cost,
			timestamp: Date.now(),
			success: input.success,
			errorMessage: input.errorMessage,
		};
		this.requests.push(record);

		// Track by endpoint
		const ep = input.endpoint || "/api/chat/completions";
		this.requestCountByEndpoint.set(
			ep,
			(this.requestCountByEndpoint.get(ep) || 0) + 1,
		);
	}

	trackError(input: TrackErrorInput): void {
		const record: ErrorRecord = {
			id: nextId(),
			type: input.type,
			source: input.source,
			message: input.message,
			timestamp: Date.now(),
		};
		this.errors.push(record);
	}

	trackChannelUsage(channel: string, sent: number, received: number): void {
		const existing = this.channelUsage.get(channel) || { sent: 0, received: 0 };
		existing.sent += sent;
		existing.received += received;
		this.channelUsage.set(channel, existing);
	}

	getSummary(): AnalyticsSummary {
		// ── Request Volume ─────────────────────────────────────────────────────
		const totalRequests = this.requests.length;
		const byEndpoint: Record<string, number> = {};
		for (const [ep, count] of this.requestCountByEndpoint) {
			byEndpoint[ep] = count;
		}

		// ── Token Usage ────────────────────────────────────────────────────────
		let totalTokens = 0;
		let totalPromptTokens = 0;
		let totalCompletionTokens = 0;
		for (const r of this.requests) {
			totalTokens += r.totalTokens;
			totalPromptTokens += r.promptTokens;
			totalCompletionTokens += r.completionTokens;
		}

		// ── Latency ────────────────────────────────────────────────────────────
		let latencySum = 0;
		let latencyMin = Infinity;
		let latencyMax = 0;
		let latencyCount = 0;
		for (const r of this.requests) {
			if (!r.success) continue;
			latencySum += r.latencyMs;
			latencyMin = Math.min(latencyMin, r.latencyMs);
			latencyMax = Math.max(latencyMax, r.latencyMs);
			latencyCount++;
		}

		// ── Errors ─────────────────────────────────────────────────────────────
		const errorsByType: Record<string, number> = {};
		for (const e of this.errors) {
			errorsByType[e.type] = (errorsByType[e.type] || 0) + 1;
		}
		const totalErrors =
			this.errors.length + this.requests.filter((r) => !r.success).length;

		// ── Provider Costs ─────────────────────────────────────────────────────
		const costsByProvider: Record<string, number> = {};
		let totalCost = 0;
		for (const r of this.requests) {
			costsByProvider[r.provider] = (costsByProvider[r.provider] || 0) + r.cost;
			totalCost += r.cost;
		}

		// ── Channel Usage ──────────────────────────────────────────────────────
		const channelUsageData: Record<string, { sent: number; received: number }> =
			{};
		let channelTotalMessages = 0;
		for (const [ch, data] of this.channelUsage) {
			channelUsageData[ch] = { sent: data.sent, received: data.received };
			channelTotalMessages += data.sent + data.received;
		}

		return {
			requestVolume: {
				total: totalRequests,
				byEndpoint,
			},
			tokenUsage: {
				total: totalTokens,
				promptTokens: totalPromptTokens,
				completionTokens: totalCompletionTokens,
				averagePerRequest:
					totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0,
			},
			latency: {
				average: latencyCount > 0 ? Math.round(latencySum / latencyCount) : 0,
				min: latencyCount > 0 ? latencyMin : 0,
				max: latencyMax,
				recentRequests: latencyCount,
			},
			errors: {
				total: totalErrors,
				rate:
					totalRequests > 0
						? parseFloat((totalErrors / totalRequests).toFixed(4))
						: 0,
				byType: errorsByType,
			},
			providerCosts: {
				byProvider: costsByProvider,
				total: parseFloat(totalCost.toFixed(6)),
			},
			sessionActivity: {
				totalSessions: 0,
				activeSessions: 0,
				totalMessages: 0,
				averageMessagesPerSession: 0,
			},
			channelUsage: {
				byChannel: channelUsageData,
				totalMessages: channelTotalMessages,
			},
			uptime: 0,
		};
	}

	/** Integrate session activity data into the summary */
	setSessionActivity(
		totalSessions: number,
		activeSessions: number,
		totalMessages: number,
	): void {
		// Session activity is set externally since the tracker doesn't own session data
		void totalSessions;
		void activeSessions;
		void totalMessages;
	}

	/** Manual uptime setter */
	setUptime(uptime: number): void {
		void uptime;
	}

	/** Get token usage aggregated by hour for the last 24 hours */
	getTokenUsageByHour(): {
		hour: string;
		prompt: number;
		completion: number;
	}[] {
		const now = Date.now();
		const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

		// Create buckets for the last 24 hours
		const buckets: Map<string, { prompt: number; completion: number }> =
			new Map();
		for (let i = 23; i >= 0; i--) {
			const h = new Date(now - i * 60 * 60 * 1000);
			const key = `${h.toISOString().slice(0, 13)}:00`; // "2026-06-27T04:00"
			buckets.set(key, { prompt: 0, completion: 0 });
		}

		// Fill in data from requests
		for (const req of this.requests) {
			if (req.timestamp < twentyFourHoursAgo) continue;
			const d = new Date(req.timestamp);
			const key = `${d.toISOString().slice(0, 13)}:00`;
			if (buckets.has(key)) {
				const b = buckets.get(key)!;
				b.prompt += req.promptTokens;
				b.completion += req.completionTokens;
			}
		}

		return Array.from(buckets.entries()).map(([hour, data]) => ({
			hour,
			prompt: data.prompt,
			completion: data.completion,
		}));
	}

	// ─── Provider Rate-Limit Monitoring ────────────────────────────────────

	private providerEvents: Array<{
		provider: string;
		type: "success" | "error" | "rate_limit" | "timeout" | "network";
		timestamp: number;
	}> = [];

	/**
	 * Track a single provider request outcome.
	 * Lightweight — just stores type, provider, and timestamp.
	 */
	trackProviderEvent(
		provider: string,
		type: "success" | "error" | "rate_limit" | "timeout" | "network",
	): void {
		this.providerEvents.push({ provider, type, timestamp: Date.now() });

		// Keep only last 5000 events to avoid unbounded memory
		if (this.providerEvents.length > 5000) {
			this.providerEvents = this.providerEvents.slice(-5000);
		}
	}

	/**
	 * Get provider health status for the status bar.
	 * Returns per-provider stats for the last 5 minutes.
	 */
	getProviderHealth(): Record<
		string,
		{
			requests1m: number;
			requests5m: number;
			rateLimits1m: number;
			rateLimits5m: number;
			errorRate: number;
			status: "healthy" | "degraded" | "throttled";
		}
	> {
		const now = Date.now();
		const oneMin = now - 60_000;
		const fiveMin = now - 300_000;

		const stats = new Map<
			string,
			{
				total1m: number;
				total5m: number;
				rl1m: number;
				rl5m: number;
				errors5m: number;
			}
		>();

		for (const ev of this.providerEvents) {
			if (ev.timestamp < fiveMin) continue;
			const s = stats.get(ev.provider) ?? {
				total1m: 0,
				total5m: 0,
				rl1m: 0,
				rl5m: 0,
				errors5m: 0,
			};

			if (ev.timestamp >= oneMin) {
				s.total1m++;
				if (ev.type === "rate_limit") s.rl1m++;
			}
			s.total5m++;
			if (ev.type === "rate_limit") s.rl5m++;
			if (ev.type === "error" || ev.type === "rate_limit") s.errors5m++;
			stats.set(ev.provider, s);
		}

		const result: Record<string, unknown> = {};
		for (const [provider, s] of stats) {
			const status =
				s.rl1m > 0
					? "throttled"
					: s.errors5m > 0 && s.errors5m / s.total5m > 0.3
						? "degraded"
						: "healthy";
			result[provider] = {
				requests1m: s.total1m,
				requests5m: s.total5m,
				rateLimits1m: s.rl1m,
				rateLimits5m: s.rl5m,
				errorRate: s.total5m > 0 ? s.errors5m / s.total5m : 0,
				status,
			};
		}
		return result as Record<string, never>;
	}

	/** Clear all provider events (for testing) */
	_clearProviderEvents(): void {
		this.providerEvents = [];
	}
}
