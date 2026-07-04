/**
 * Retry — shared retry configuration, pattern matching, and classification.
 *
 * Extracted from tools.ts and error-handler.ts to eliminate duplicated
 * retryable-error pattern lists that drift apart over time.
 */

// ── Patterns ─────────────────────────────────────────────────────────────────

/** Patterns indicating the error is transient and may succeed on retry */
export const RETRYABLE_ERROR_PATTERNS: RegExp[] = [
	/\brate\s*limit\b/i,
	/\btoo\s*many\s*requests\b/i,
	/\b429\b/,
	/\b503\b/,
	/\b502\b/,
	/\btimeout\b/i,
	/\btimed?\s*out\b/i,
	/\bdeadline\b/i,
	/\bunavailable\b/i,
	/\boverloaded\b/i,
	/\bretry\b/i,
	/\bnetwork\s*error\b/i,
	/\bconnection\b.*\b(refused|reset|closed|timeout)\b/i,
];

/** Patterns indicating a timeout */
export const TIMEOUT_PATTERNS: RegExp[] = [
	/timeout/i,
	/timed out/i,
	/etimedout/i,
];

/** Patterns indicating a network error */
export const NETWORK_PATTERNS: RegExp[] = [
	/network/i,
	/connection refused/i,
	/econnreset/i,
	/eai_again/i,
	/enotfound/i,
];

// ── Pattern Matching ─────────────────────────────────────────────────────────

/** Check if a message matches any of the given patterns */
export function matchesPatterns(message: string, patterns: RegExp[]): boolean {
	return patterns.some((p) => p.test(message));
}

// ── Classification ──────────────────────────────────────────────────────────

/** Check if an error message indicates a retryable error */
export function isRetryable(errorMessage: string): boolean {
	return matchesPatterns(errorMessage, RETRYABLE_ERROR_PATTERNS);
}

/** Map an error message to a machine-readable code */
export function classifyError(message: string): string {
	const lower = message.toLowerCase();
	if (/rate\s*limit|too\s*many|429/.test(lower)) return "rate_limit";
	if (/timeout|timed?\s*out|deadline/.test(lower)) return "timeout";
	if (/unavailable|overloaded|503|502/.test(lower))
		return "service_unavailable";
	if (/network|connection|econnreset|eai_again|enotfound/.test(lower))
		return "network";
	if (/not found|404/.test(lower)) return "not_found";
	if (/auth|unauthorized|403|401/.test(lower)) return "auth";
	return "unknown";
}
