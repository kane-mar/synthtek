/**
 * Agent Error Handler — Error classification, retry logic, and circuit breaker
 * Extracted from AgentLoop for single-responsibility.
 */

import {
	classifyError as classifyErrorMessage,
	matchesPatterns,
	RETRYABLE_ERROR_PATTERNS,
} from "./retry.js";
import type { AgentLoopConfig } from "./types.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ErrorCategory =
	| "provider"
	| "tool"
	| "context"
	| "rate_limit"
	| "timeout"
	| "network"
	| "circuit_breaker"
	| "max_retries"
	| "max_tool_calls"
	| "invalid_tool_args"
	| "tool_timeout"
	| "tool_not_found"
	| "tool_permission_denied"
	| "tool_rate_limited"
	| "unknown";

export interface CircuitBreakerState {
	failures: number;
	lastFailureAt: number | null;
	state: "closed" | "open" | "half-open";
}

// ─── Error Category Detection ────────────────────────────────────────────────

// Note: All pattern definitions (RATE_LIMIT_PATTERNS, TIMEOUT_PATTERNS,
// NETWORK_PATTERNS, RETRYABLE_ERROR_PATTERNS) and classifyError() are
// consolidated in retry.ts to eliminate duplicated pattern lists.

// ─── AgentErrorHandler Class ─────────────────────────────────────────────────

export class AgentErrorHandler {
	// Configuration values — publicly accessible for testing and introspection
	maxRetries: number;
	initialDelay: number;
	maxDelay: number;
	readonly multiplier: number;
	readonly retryablePatterns: RegExp[];
	failureThreshold: number;
	recoveryTimeout: number;

	private circuitBreaker: CircuitBreakerState = {
		failures: 0,
		lastFailureAt: null,
		state: "closed",
	};

	constructor(config: Partial<AgentLoopConfig>) {
		const retry = config.retry;
		this.maxRetries = retry?.maxRetries ?? 3;
		this.initialDelay = retry?.initialDelay ?? 1000;
		this.maxDelay = retry?.maxDelay ?? 30000;
		this.multiplier = retry?.multiplier ?? 2;
		this.retryablePatterns = retry?.retryableErrors ?? RETRYABLE_ERROR_PATTERNS;

		const cb = config.circuitBreaker;
		this.failureThreshold = cb?.failureThreshold ?? 5;
		this.recoveryTimeout = cb?.recoveryTimeout ?? 60000;
	}

	/** Classify an error into a category based on its type hint and message */
	classifyError(error: Error, typeHint?: string): ErrorCategory {
		// Explicit type hints take priority
		switch (typeHint) {
			case "provider_error":
				return "provider";
			case "tool_error":
				return "tool";
			case "context_error":
				return "context";
			case "rate_limit":
				return "rate_limit";
			case "timeout":
				return "timeout";
			case "network_error":
				return "network";
		}

		// Fallback to message-based classification (delegated to retry.ts)
		const message = error.message.toLowerCase();
		const msgCategory = classifyErrorMessage(error.message);

		if (message.includes("context") || message.includes("token limit"))
			return "context";
		if (msgCategory === "rate_limit") return "rate_limit";
		if (msgCategory === "timeout") return "timeout";
		if (msgCategory === "network") return "network";
		if (msgCategory === "auth") return "provider";
		if (
			message.includes("provider") ||
			message.includes("llm") ||
			message.includes("api")
		)
			return "provider";
		if (message.includes("tool")) return "tool";

		return "unknown";
	}

	/** Calculate retry delay with exponential backoff */
	calculateRetryDelay(attempt: number): number {
		const exponentialDelay = this.initialDelay * this.multiplier ** attempt;
		return Math.min(exponentialDelay, this.maxDelay);
	}

	/** Determine if an error should trigger a retry */
	shouldRetry(error: Error, currentAttempt: number): boolean {
		if (currentAttempt >= this.maxRetries) return false;

		const category = this.classifyError(error);
		// Non-retryable categories
		if (category === "context") return false;

		// Check against retryable patterns
		return (
			matchesPatterns(error.message, this.retryablePatterns) ||
			category === "provider" ||
			category === "timeout" ||
			category === "network" ||
			category === "rate_limit"
		);
	}

	// ─── Circuit Breaker ──────────────────────────────────────────────────────

	/**
	 * Record a failed LLM call. Returns true if circuit breaker just opened.
	 */
	recordFailure(): boolean {
		this.circuitBreaker.failures += 1;
		this.circuitBreaker.lastFailureAt = Date.now();
		if (
			this.circuitBreaker.failures >= this.failureThreshold &&
			this.circuitBreaker.state !== "open"
		) {
			this.circuitBreaker.state = "open";
			return true; // state just transitioned to open
		}
		return false;
	}

	/**
	 * Record a successful LLM call. Returns true if circuit breaker state changed.
	 */
	recordSuccess(): boolean {
		const wasOpen = this.circuitBreaker.state !== "closed";
		this.circuitBreaker.failures = 0;
		this.circuitBreaker.state = "closed";
		return wasOpen; // true if it was open/closed/half-open and now closed
	}

	isCircuitOpen(): boolean {
		if (this.circuitBreaker.state === "closed") return false;
		if (this.circuitBreaker.state === "open") {
			// Check if recovery timeout has elapsed
			if (
				this.circuitBreaker.lastFailureAt !== null &&
				Date.now() - this.circuitBreaker.lastFailureAt >= this.recoveryTimeout
			) {
				this.circuitBreaker.state = "half-open";
				return false;
			}
			return true;
		}
		// half-open: allow one request through
		return false;
	}
}
