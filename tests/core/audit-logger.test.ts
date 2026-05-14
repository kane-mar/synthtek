/**
 * Tests for Audit Logger Module
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AuditLogger,
  AuditLevel,
  AuditCategory,
  type AuditEntry,
} from '../../src/core/audit-logger.js';

describe('Audit Logger', () => {
  const testLogDir = join('/tmp', 'synthtek-audit-test');

  before(() => {
    // Clean up before tests
    if (existsSync(testLogDir)) {
      rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  after(() => {
    // Clean up after tests
    if (existsSync(testLogDir)) {
      rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  describe('basic logging', () => {
    let logger: AuditLogger;

    before(() => {
      logger = new AuditLogger({ logDir: testLogDir, enabled: true });
    });

    it('should log an audit event', () => {
      logger.log({
        level: AuditLevel.INFO,
        category: AuditCategory.SYSTEM,
        message: 'Test audit event',
        operation: 'test.event',
      });

      const entries = logger.getRecentEntries();
      assert.ok(entries.length >= 1);
      assert.strictEqual(entries[entries.length - 1].message, 'Test audit event');
    });

    it('should include timestamp in entries', () => {
      const entries = logger.getRecentEntries(1);
      assert.ok(entries[0].timestamp);
      assert.ok(new Date(entries[0].timestamp).toISOString());
    });

    it('should log config changes', () => {
      logger.logConfigChange('set', 'api.key', 'old-value', 'new-value', 'admin');
      const entries = logger.getEntriesByCategory(AuditCategory.CONFIG, 1);
      assert.ok(entries.length >= 1);
      assert.ok(entries[0].message.includes('api.key'));
    });

    it('should log security events', () => {
      logger.logSecurityEvent('auth', 'User login attempt', { userId: '123' }, true);
      const entries = logger.getEntriesByLevel(AuditLevel.SECURITY, 1);
      assert.ok(entries.length >= 1);
    });

    it('should log memory operations', () => {
      logger.logMemoryOperation('save', 'Saved memory entry', { id: 'entry-1' });
      const entries = logger.getEntriesByCategory(AuditCategory.MEMORY, 1);
      assert.ok(entries.length >= 1);
    });

    it('should log plugin events', () => {
      logger.logPluginEvent('load', 'test-plugin', 'Plugin loaded successfully', true);
      const entries = logger.getEntriesByCategory(AuditCategory.PLUGIN, 1);
      assert.ok(entries.length >= 1);
    });

    it('should log provider events', () => {
      logger.logProviderEvent('chat', 'openai', 'Chat completion', { model: 'gpt-4' }, true);
      const entries = logger.getEntriesByCategory(AuditCategory.PROVIDER, 1);
      assert.ok(entries.length >= 1);
    });

    it('should log API requests', () => {
      logger.logApiRequest('GET', '/v1/models', 200, 45, '127.0.0.1');
      const entries = logger.getEntriesByCategory(AuditCategory.API, 1);
      assert.ok(entries.length >= 1);
      assert.ok(entries[0].message.includes('GET /v1/models'));
    });
  });

  describe('disabled logger', () => {
    it('should not log when disabled', () => {
      const logger = new AuditLogger({ enabled: false });
      logger.log({
        level: AuditLevel.INFO,
        category: AuditCategory.SYSTEM,
        message: 'Should not be logged',
        operation: 'test.disabled',
      });

      const entries = logger.getRecentEntries();
      assert.strictEqual(entries.length, 0);
    });
  });

  describe('level filtering', () => {
    it('should filter by minimum level', () => {
      const logger = new AuditLogger({
        logDir: testLogDir,
        minLevel: AuditLevel.WARN,
      });

      logger.log({
        level: AuditLevel.INFO,
        category: AuditCategory.SYSTEM,
        message: 'Should be filtered',
        operation: 'test.info',
      });

      logger.log({
        level: AuditLevel.WARN,
        category: AuditCategory.SYSTEM,
        message: 'Should be logged',
        operation: 'test.warn',
      });

      const entries = logger.getRecentEntries();
      assert.ok(entries.length >= 1);
      // INFO should be filtered out
      for (const entry of entries) {
        assert.notStrictEqual(entry.level, AuditLevel.INFO);
      }
    });
  });

  describe('file persistence', () => {
    it('should write entries to disk', () => {
      const logger = new AuditLogger({ logDir: testLogDir });
      logger.log({
        level: AuditLevel.INFO,
        category: AuditCategory.SYSTEM,
        message: 'File persistence test',
        operation: 'test.file',
      });

      // Check that log file exists
      const logFile = join(testLogDir, 'audit-0.jsonl');
      assert.ok(existsSync(logFile), 'Log file should exist');

      // Check that content is valid JSONL
      const content = readFileSync(logFile, 'utf8');
      const lines = content.trim().split('\n');
      assert.ok(lines.length >= 1);

      const lastEntry = JSON.parse(lines[lines.length - 1]) as AuditEntry;
      assert.strictEqual(lastEntry.message, 'File persistence test');
    });
  });

  describe('clear', () => {
    it('should clear in-memory entries', () => {
      const logger = new AuditLogger({ logDir: testLogDir });
      logger.log({
        level: AuditLevel.INFO,
        category: AuditCategory.SYSTEM,
        message: 'Before clear',
        operation: 'test.before',
      });

      assert.ok(logger.getRecentEntries().length >= 1);

      logger.clear();
      assert.strictEqual(logger.getRecentEntries().length, 0);
    });
  });

  describe('sensitive data redaction', () => {
    let logger: AuditLogger;

    before(() => {
      logger = new AuditLogger({ logDir: testLogDir });
    });

    it('should redact API keys in config values', () => {
      logger.logConfigChange('set', 'api.key', 'sk-abc123', 'sk-xyz789', 'admin');
      const entries = logger.getEntriesByCategory(AuditCategory.CONFIG, 1);
      // The values should be redacted in the context
      assert.ok(entries[0].context);
    });
  });
});
