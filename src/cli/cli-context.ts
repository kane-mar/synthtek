/**
 * CLI shared context — logger, config, and rate limiters
 * Uses lazy initialization so these are only created when actually used.
 */

import { RateLimiter } from "../core/cli-validation.js";
import { ConfigServiceImpl } from "../core/config.js";
import { SimpleLogger } from "../core/logger.js";

let _logger: SimpleLogger | undefined;
let _config: ConfigServiceImpl | undefined;
let _configRateLimiter: RateLimiter | undefined;

export function getLogger(): SimpleLogger {
	if (!_logger) {
		_logger = new SimpleLogger({ level: "info", prefix: "synthtek" });
	}
	return _logger;
}

export function getConfig(): ConfigServiceImpl {
	if (!_config) {
		_config = new ConfigServiceImpl();
	}
	return _config;
}

export function getRateLimiter(): RateLimiter {
	if (!_configRateLimiter) {
		_configRateLimiter = new RateLimiter(30);
	}
	return _configRateLimiter;
}

// Backward-compat aliases (prefer getter functions for testability)
export const logger = getLogger();
export const config = getConfig();
export const configRateLimiter = getRateLimiter();
