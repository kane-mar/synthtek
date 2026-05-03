/**
 * Shell sandbox for synthtek
 * Validates and sanitizes shell commands to prevent dangerous operations
 */

import type { SandboxConfig, SandboxResult } from './types.js';

const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  allowedCommands: ['ls', 'cat', 'echo', 'grep', 'find', 'pwd', 'whoami', 'date', 'head', 'tail'],
  blockedCommands: ['rm', 'sudo', 'chmod', 'chown', 'kill', 'shutdown', 'reboot', 'format', 'dd'],
  maxExecutionTimeMs: 10000,
  allowPipes: false,
  allowRedirects: false,
  allowBackground: false,
  allowSudo: false,
  maxArgs: 20,
  validatePaths: true,
  allowedPathPrefixes: ['/tmp', '/home', '/var'],
};

export class ShellSandbox {
  private readonly _config: SandboxConfig;

  constructor(config?: Partial<SandboxConfig>) {
    this._config = { ...DEFAULT_SANDBOX_CONFIG, ...config };
  }

  validate(command: string): SandboxResult {
    // Check for dangerous patterns
    if (!this._config.allowPipes && command.includes('|')) {
      return { allowed: false, reason: 'Pipes are not allowed' };
    }

    if (!this._config.allowRedirects && (command.includes('>') || command.includes('<'))) {
      return { allowed: false, reason: 'Redirects are not allowed' };
    }

    if (!this._config.allowBackground && command.includes('&')) {
      return { allowed: false, reason: 'Background processes are not allowed' };
    }

    // Parse command and arguments
    const parts = this._parseCommand(command);
    if (!parts) {
      return { allowed: false, reason: 'Invalid command format' };
    }

    const { cmd, args, paths } = parts;

    // Check for sudo
    if (!this._config.allowSudo && (cmd === 'sudo' || args.includes('sudo'))) {
      return { allowed: false, reason: 'Sudo is not allowed' };
    }

    // Check blocked commands
    if (this._config.blockedCommands?.includes(cmd)) {
      return { allowed: false, reason: `Command '${cmd}' is blocked` };
    }

    // Check allowed commands
    if (this._config.allowedCommands && !this._config.allowedCommands.includes(cmd)) {
      return { allowed: false, reason: `Command '${cmd}' is not in the allowed list` };
    }

    // Check argument count
    if (this._config.maxArgs && args.length > this._config.maxArgs) {
      return { allowed: false, reason: `Too many arguments (max ${this._config.maxArgs})` };
    }

    // Validate paths
    if (this._config.validatePaths && paths.length > 0) {
      for (const path of paths) {
        if (!this._isPathAllowed(path)) {
          return { allowed: false, reason: `Path '${path}' is not allowed` };
        }
      }
    }

    return {
      allowed: true,
      sanitizedCommand: command,
    };
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _parseCommand(command: string): { cmd: string; args: string[]; paths: string[] } | null {
    // Remove leading/trailing whitespace
    const trimmed = command.trim();
    if (!trimmed) return null;

    // Split by whitespace, handling quotes
    const parts: string[] = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';

    for (const char of trimmed) {
      if (inQuote) {
        if (char === quoteChar) {
          inQuote = false;
        } else {
          current += char;
        }
      } else if (char === '"' || char === "'") {
        inQuote = true;
        quoteChar = char;
      } else if (char === ' ' || char === '\t') {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
    if (current) parts.push(current);

    if (parts.length === 0) return null;

    // Extract paths (arguments starting with /)
    const paths = parts.filter((p) => p.startsWith('/'));

    return {
      cmd: parts[0],
      args: parts.slice(1),
      paths,
    };
  }

  private _isPathAllowed(path: string): boolean {
    if (!this._config.allowedPathPrefixes) return true;

    return this._config.allowedPathPrefixes.some((prefix) => path.startsWith(prefix));
  }
}
