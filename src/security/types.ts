/**
 * Security module — types for session protection, sanitization, sandboxing,
 * access control, encryption, and rate limiting.
 */

// ── Session Poisoning Protection ─────────────────────────────────────────────

export interface SessionPoisoningConfig {
  /** Maximum number of messages per session before requiring re-auth */
  maxMessagesPerSession?: number;
  /** Maximum session lifetime in milliseconds */
  maxSessionLifetimeMs?: number;
  /** Whether to validate message integrity hashes */
  enableIntegrityCheck?: boolean;
  /** Whether to detect prompt injection patterns */
  detectPromptInjection?: boolean;
}

export interface SessionIntegrityResult {
  /** Whether the session is still valid */
  valid: boolean;
  /** Reason for invalidation if not valid */
  reason?: string;
  /** Detected injection patterns */
  injections?: string[];
}

// ── Input Sanitization ───────────────────────────────────────────────────────

export interface SanitizerConfig {
  /** Maximum input length in characters */
  maxLength?: number;
  /** Whether to strip HTML tags */
  stripHtml?: boolean;
  /** Whether to escape shell metacharacters */
  escapeShell?: boolean;
  /** Whether to detect and block prompt injection patterns */
  blockPromptInjection?: boolean;
  /** Whether to normalize unicode */
  normalizeUnicode?: boolean;
  /** Custom patterns to block */
  blockPatterns?: RegExp[];
}

export interface SanitizeResult {
  /** The sanitized input */
  sanitized: string;
  /** Whether any modifications were made */
  modified: boolean;
  /** Warnings about blocked content */
  warnings: string[];
}

// ── Shell Sandboxing ─────────────────────────────────────────────────────────

export interface SandboxConfig {
  /** Commands that are allowed to execute */
  allowedCommands?: string[];
  /** Commands that are explicitly blocked */
  blockedCommands?: string[];
  /** Maximum execution time in milliseconds */
  maxExecutionTimeMs?: number;
  /** Whether to allow pipes */
  allowPipes?: boolean;
  /** Whether to allow redirects */
  allowRedirects?: boolean;
  /** Whether to allow background processes */
  allowBackground?: boolean;
  /** Whether to allow sudo */
  allowSudo?: boolean;
  /** Maximum number of arguments */
  maxArgs?: number;
  /** Whether to validate file paths */
  validatePaths?: boolean;
  /** Allowed file path prefixes */
  allowedPathPrefixes?: string[];
}

export interface SandboxResult {
  /** Whether the command is allowed */
  allowed: boolean;
  /** Reason for blocking if not allowed */
  reason?: string;
  /** The sanitized command if allowed */
  sanitizedCommand?: string;
}

// ── Access Control ───────────────────────────────────────────────────────────

export type AccessLevel = 'none' | 'read' | 'write' | 'admin';

export interface AccessControlRule {
  /** Channel identifier (e.g., 'telegram', 'discord', 'slack') */
  channel?: string;
  /** User identifier */
  user?: string;
  /** Access level granted */
  level: AccessLevel;
  /** Specific resources this rule applies to (empty = all) */
  resources?: string[];
  /** Time-based restrictions (cron-like) */
  timeRestriction?: string;
  /** Whether this rule is active */
  active?: boolean;
}

export interface AccessControlConfig {
  /** Default access level for unauthenticated users */
  defaultLevel?: AccessLevel;
  /** Whether to deny by default (whitelist mode) */
  denyByDefault?: boolean;
  /** Access control rules */
  rules?: AccessControlRule[];
}

export interface AccessCheckResult {
  /** Whether access is granted */
  granted: boolean;
  /** The effective access level */
  level: AccessLevel;
  /** Reason for denial if not granted */
  reason?: string;
}

// ── Encryption ───────────────────────────────────────────────────────────────

export interface EncryptionConfig {
  /** Encryption algorithm to use */
  algorithm?: 'aes-256-gcm' | 'aes-256-cbc';
  /** Key derivation iterations */
  iterations?: number;
  /** Whether to use a key file */
  useKeyFile?: boolean;
  /** Path to the key file */
  keyFilePath?: string;
}

export interface EncryptedKey {
  /** The encrypted value */
  ciphertext: string;
  /** Initialization vector */
  iv: string;
  /** Authentication tag (for GCM mode) */
  tag?: string;
  /** Salt used for key derivation */
  salt: string;
  /** When the key was encrypted */
  timestamp: number;
}

export interface EncryptionResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** The encrypted or decrypted value */
  value?: string;
  /** Error message if failed */
  error?: string;
}

// ── Rate Limiting ────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests?: number;
  /** Window duration in milliseconds */
  windowMs?: number;
  /** Whether to use sliding window */
  slidingWindow?: boolean;
  /** Per-user rate limits (overrides global) */
  perUserLimits?: Record<string, { maxRequests: number; windowMs: number }>;
  /** Per-channel rate limits */
  perChannelLimits?: Record<string, { maxRequests: number; windowMs: number }>;
  /** Whether to ban after exceeding limits */
  banOnExceed?: boolean;
  /** Ban duration in milliseconds */
  banDurationMs?: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in the current window */
  remaining: number;
  /** Reset time in milliseconds */
  resetMs: number;
  /** Whether the requester is banned */
  banned: boolean;
  /** Ban expiry time if banned */
  banExpiry?: number;
}

// ── Security Config (aggregate) ──────────────────────────────────────────────

export interface SecurityConfig {
  sessionPoisoning?: SessionPoisoningConfig;
  sanitizer?: SanitizerConfig;
  sandbox?: SandboxConfig;
  accessControl?: AccessControlConfig;
  encryption?: EncryptionConfig;
  rateLimit?: RateLimitConfig;
}
