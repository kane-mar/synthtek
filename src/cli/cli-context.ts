/**
 * CLI shared context — logger, config, and rate limiters
 */

import { RateLimiter } from "../core/cli-validation.js";
import { ConfigServiceImpl } from "../core/config.js";
import { SimpleLogger } from "../core/logger.js";

export const logger = new SimpleLogger({ level: "info", prefix: "synthtek" });
export const config = new ConfigServiceImpl();
export const configRateLimiter = new RateLimiter(30);
