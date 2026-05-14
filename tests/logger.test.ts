/**
 * Tests for SimpleLogger
 */

import { describe, it } from 'node:test';
import { equal, ok } from 'node:assert';
import { SimpleLogger } from '../src/core/logger.js';

describe('SimpleLogger', () => {
  it('logs info messages by default', () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    const logger = new SimpleLogger({ level: 'info', prefix: 'test' });
    logger.info('hello');

    equal(logs.length, 1);
    ok(logs[0].includes('INFO'));
    ok(logs[0].includes('[test]'));
    ok(logs[0].includes('hello'));

    console.log = originalLog;
  });

  it('logs debug messages when level is debug', () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    const logger = new SimpleLogger({ level: 'debug', prefix: 'test' });
    logger.debug('debug msg');

    equal(logs.length, 1);
    ok(logs[0].includes('DEBUG'));

    console.log = originalLog;
  });

  it('does not log debug messages when level is info', () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    const logger = new SimpleLogger({ level: 'info', prefix: 'test' });
    logger.debug('debug msg');

    equal(logs.length, 0);

    console.log = originalLog;
  });

  it('logs warnings to stderr', () => {
    const logs: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args) => logs.push(args.join(' '));

    const logger = new SimpleLogger({ level: 'info', prefix: 'test' });
    logger.warn('warning msg');

    equal(logs.length, 1);
    ok(logs[0].includes('WARN'));

    console.warn = originalWarn;
  });

  it('logs errors to stderr', () => {
    const logs: string[] = [];
    const originalError = console.error;
    console.error = (...args) => logs.push(args.join(' '));

    const logger = new SimpleLogger({ level: 'info', prefix: 'test' });
    logger.error('error msg');

    equal(logs.length, 1);
    ok(logs[0].includes('ERROR'));

    console.error = originalError;
  });

  it('includes timestamp by default', () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    const logger = new SimpleLogger({ level: 'info', prefix: 'test', timestamp: true });
    logger.info('msg');

    equal(logs.length, 1);
    ok(/^\d{4}-\d{2}-\d{2}T/.test(logs[0]));

    console.log = originalLog;
  });

  it('omits timestamp when disabled', () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    const logger = new SimpleLogger({ level: 'info', prefix: 'test', timestamp: false });
    logger.info('msg');

    equal(logs.length, 1);
    ok(!/^\d{4}-\d{2}-\d{2}T/.test(logs[0]));

    console.log = originalLog;
  });

  it('includes metadata when provided', () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    const logger = new SimpleLogger({ level: 'info', prefix: 'test' });
    logger.info('msg', { key: 'value' });

    equal(logs.length, 1);
    ok(logs[0].includes('"key"'));
    ok(logs[0].includes('"value"'));

    console.log = originalLog;
  });

  it('can change log level at runtime', () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    const logger = new SimpleLogger({ level: 'info', prefix: 'test' });
    logger.debug('before');
    logger.setLevel('debug');
    logger.debug('after');

    equal(logs.length, 1);
    ok(logs[0].includes('after'));

    console.log = originalLog;
  });
});
