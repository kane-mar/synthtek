/**
 * CLI shared context — logger, config, and rate limiters
 */

import { SimpleLogger, ConfigServiceImpl } from '../core/index.js';
import { RateLimiter } from '../core/cli-validation.js';

export const logger = new SimpleLogger({ level: 'info', prefix: 'synthtek' });
export const config = new ConfigServiceImpl();
export const configRateLimiter = new RateLimiter(30);
