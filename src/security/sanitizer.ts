/**
 * Input sanitizer for synthtek
 * Sanitizes user input to prevent XSS, shell injection, and prompt injection
 */

import type { SanitizerConfig, SanitizeResult } from './types.js';

const DEFAULT_SANITIZER_CONFIG: SanitizerConfig = {
  maxLength: 10000,
  stripHtml: true,
  escapeShell: true,
  blockPromptInjection: true,
  normalizeUnicode: true,
};

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+previous\s+instructions/i,
  /disregard\s+all\s+prior/i,
  /you\s+are\s+now\s+free/i,
  /jailbreak/i,
  /dan\s+mode/i,
  /developer\s+mode/i,
  /system\s+prompt/i,
  /override\s+security/i,
];

const SHELL_METACHARACTERS = [';', '|', '&', '`', '$', '(', ')', '{', '}', '<', '>', '#', '~'];

export class InputSanitizer {
  private readonly _config: SanitizerConfig;

  constructor(config?: Partial<SanitizerConfig>) {
    this._config = { ...DEFAULT_SANITIZER_CONFIG, ...config };
  }

  sanitize(input: string): SanitizeResult {
    const warnings: string[] = [];
    let modified = false;
    let result = input;

    // Check max length
    const maxLength = this._config.maxLength ?? 10000;
    if (result.length > maxLength) {
      result = result.slice(0, maxLength);
      modified = true;
      warnings.push(`Input truncated to ${this._config.maxLength} characters`);
    }

    // Strip HTML
    if (this._config.stripHtml) {
      const htmlPattern = /<[^>]*>/g;
      if (htmlPattern.test(result)) {
        result = result.replace(htmlPattern, '');
        modified = true;
        warnings.push('HTML tags removed');
      }
    }

    // Escape shell metacharacters
    if (this._config.escapeShell) {
      let escaped = false;
      for (const char of SHELL_METACHARACTERS) {
        if (result.includes(char)) {
          result = result.replace(new RegExp(`\\${char}`, 'g'), `\\${char}`);
          escaped = true;
        }
      }
      if (escaped) {
        modified = true;
        warnings.push('Shell metacharacters escaped');
      }
    }

    // Block prompt injection
    if (this._config.blockPromptInjection) {
      for (const pattern of PROMPT_INJECTION_PATTERNS) {
        if (pattern.test(result)) {
          warnings.push(`Prompt injection pattern detected: ${pattern.source}`);
          modified = true;
          break;
        }
      }
    }

    // Custom block patterns
    if (this._config.blockPatterns) {
      for (const pattern of this._config.blockPatterns) {
        if (pattern.test(result)) {
          warnings.push(`Custom block pattern matched: ${pattern.source}`);
          modified = true;
          break;
        }
      }
    }

    // Normalize unicode
    if (this._config.normalizeUnicode) {
      try {
        result = result.normalize('NFC');
      } catch {
        // Ignore unicode normalization errors
      }
    }

    return { sanitized: result, modified, warnings };
  }

  isSafe(input: string): boolean {
    const result = this.sanitize(input);
    return !result.modified && result.warnings.length === 0;
  }
}
