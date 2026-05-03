/**
 * Security Manager
 *
 * Unifies all security components (sanitizer, sandbox, access control,
 * rate limiter, encryption) into a single manager for the agent.
 */

import type {
  SecurityConfig,
  SanitizeResult,
  SandboxResult,
  AccessCheckResult,
  RateLimitResult,
  EncryptionResult,
} from './types.js';
import { InputSanitizer } from './sanitizer.js';
import { ShellSandbox } from './sandbox.js';
import { AccessControl } from './access-control.js';
import { RateLimiter } from './rate-limiter.js';
import { ApiKeyEncryption } from './encryption.js';

export class SecurityManager {
  public readonly sanitizer: InputSanitizer;
  public readonly sandbox: ShellSandbox;
  public readonly accessControl: AccessControl;
  public readonly rateLimiter: RateLimiter;
  public readonly encryption: ApiKeyEncryption;

  constructor(config?: SecurityConfig) {
    this.sanitizer = new InputSanitizer(config?.sanitizer);
    this.sandbox = new ShellSandbox(config?.sandbox);
    this.accessControl = new AccessControl(config?.accessControl);
    this.rateLimiter = new RateLimiter(config?.rateLimit);
    this.encryption = new ApiKeyEncryption(config?.encryption);
  }

  /**
   * Initialize the security manager (loads encryption keys, etc.)
   */
  async init(): Promise<void> {
    await this.encryption.init();
  }

  /**
   * Sanitize an input string.
   */
  sanitize(input: string): SanitizeResult {
    return this.sanitizer.sanitize(input);
  }

  /**
   * Validate a shell command against sandbox rules.
   */
  validateCommand(command: string): SandboxResult {
    return this.sandbox.validate(command);
  }

  /**
   * Check if a user has access on a given channel.
   */
  checkAccess(channel: string, user: string): AccessCheckResult {
    return this.accessControl.check(channel, user);
  }

  /**
   * Check if a user has access to a specific resource.
   */
  checkResourceAccess(user: string, resource: string): AccessCheckResult {
    return this.accessControl.checkResource(user, resource);
  }

  /**
   * Check rate limit for a user.
   */
  checkRateLimit(userId: string): RateLimitResult {
    return this.rateLimiter.check(userId);
  }

  /**
   * Get rate limit stats for a user.
   */
  getRateLimitStats(userId: string): {
    totalRequests: number;
    windowRequests: number;
    banned: boolean;
  } | null {
    return this.rateLimiter.stats(userId);
  }

  /**
   * Encrypt a value.
   */
  async encrypt(plaintext: string): Promise<EncryptionResult> {
    return this.encryption.encrypt(plaintext);
  }

  /**
   * Decrypt a value.
   */
  async decrypt(encryptedValue: string): Promise<EncryptionResult> {
    return this.encryption.decrypt(encryptedValue);
  }
}
