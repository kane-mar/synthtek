/**
 * Rate limiter for synthtek
 * Tracks and limits request rates per user/channel
 */

import type { RateLimitConfig, RateLimitResult } from "./types.js";

const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
	maxRequests: 60,
	windowMs: 60000,
	slidingWindow: false,
	banOnExceed: false,
	banDurationMs: 300000,
};

interface RequestRecord {
	timestamp: number;
}

interface UserState {
	requests: RequestRecord[];
	banned: boolean;
	banExpiry: number | null;
}

export class RateLimiter {
	private readonly _config: RateLimitConfig;
	private readonly _users: Map<string, UserState> = new Map();

	constructor(config?: Partial<RateLimitConfig>) {
		this._config = { ...DEFAULT_RATE_LIMIT_CONFIG, ...config };
	}

	check(userId: string): RateLimitResult {
		const userState = this._getUserState(userId);
		const maxRequests = this._getMaxRequests(userId);
		const windowMs = this._getWindowMs(userId);

		// Check if user is banned
		if (userState.banned) {
			if (userState.banExpiry && Date.now() < userState.banExpiry) {
				return {
					allowed: false,
					remaining: 0,
					resetMs: userState.banExpiry - Date.now(),
					banned: true,
					banExpiry: userState.banExpiry,
				};
			}
			// Ban expired, reset
			userState.banned = false;
			userState.banExpiry = null;
			userState.requests = [];
		}

		// Clean old requests outside the window
		const cutoff = Date.now() - windowMs;
		userState.requests = userState.requests.filter((r) => r.timestamp > cutoff);

		// Check if limit exceeded
		if (userState.requests.length >= maxRequests) {
			if (this._config.banOnExceed) {
				userState.banned = true;
				userState.banExpiry =
					Date.now() + (this._config.banDurationMs ?? 300000);
			}
			return {
				allowed: false,
				remaining: 0,
				resetMs: windowMs - (Date.now() - userState.requests[0]?.timestamp),
				banned: userState.banned,
				banExpiry: userState.banExpiry ?? undefined,
			};
		}

		// Add request
		userState.requests.push({ timestamp: Date.now() });

		return {
			allowed: true,
			remaining: maxRequests - userState.requests.length,
			resetMs: windowMs,
			banned: false,
		};
	}

	stats(
		userId: string,
	): { totalRequests: number; windowRequests: number; banned: boolean } | null {
		const userState = this._getUserState(userId);
		const windowMs = this._getWindowMs(userId);
		const cutoff = Date.now() - windowMs;

		return {
			totalRequests: userState.requests.length,
			windowRequests: userState.requests.filter((r) => r.timestamp > cutoff)
				.length,
			banned: userState.banned,
		};
	}

	// ── Private ──────────────────────────────────────────────────────────────

	private _getUserState(userId: string): UserState {
		if (!this._users.has(userId)) {
			this._users.set(userId, {
				requests: [],
				banned: false,
				banExpiry: null,
			});
		}
		return this._users.get(userId)!;
	}

	private _getMaxRequests(userId: string): number {
		const perUser = this._config.perUserLimits?.[userId];
		return perUser?.maxRequests ?? this._config.maxRequests ?? 60;
	}

	private _getWindowMs(userId: string): number {
		const perUser = this._config.perUserLimits?.[userId];
		return perUser?.windowMs ?? this._config.windowMs ?? 60000;
	}
}
