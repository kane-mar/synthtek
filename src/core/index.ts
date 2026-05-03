/**
 * synthtek — Core barrel exports
 */

export * from './types.js';
export { SimpleLogger } from './logger.js';
export { AsyncFileService } from './filesystem.js';
export { AsyncExecutor } from './executor.js';
export { SearchService } from './search.js';
export { AgentSpawner } from './spawner.js';
export { MessengerServiceImpl } from './messenger.js';
export { ConfigServiceImpl } from './config.js';

// CLI validation module
export {
  sanitizePath,
  validateConfigKey,
  validateConfigValue,
  validateCommand,
  validateGlobPattern,
  validateTimeout,
  RateLimiter,
  ValidationError,
} from './cli-validation.js';

// Audit logger module
export { AuditLogger, AuditLevel, AuditCategory } from './audit-logger.js';

// Memory module
export * from '../memory/index.js';

// MCP module
export * from '../mcp/index.js';
