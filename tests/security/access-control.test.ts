/**
 * Tests for AccessControl (per-user, per-channel access control)
 */

import { describe, it, beforeEach } from 'node:test';
import { ok, strictEqual } from 'node:assert';
import { AccessControl } from '../../src/security/access-control.js';
import type { AccessControlConfig } from '../../src/security/types.js';

const defaultConfig: AccessControlConfig = {
  defaultLevel: 'read',
  denyByDefault: false,
  rules: [
    { channel: 'telegram', user: 'admin-user', level: 'admin' },
    { channel: 'telegram', user: 'mod-user', level: 'write' },
    { channel: 'discord', user: 'discord-admin', level: 'admin' },
    { channel: 'slack', level: 'read' }, // channel-wide rule
  ],
};

describe('AccessControl', () => {
  let ac: AccessControl;

  beforeEach(() => {
    ac = new AccessControl(defaultConfig);
  });

  describe('check', () => {
    it('grants admin access to admin user', () => {
      const result = ac.check('telegram', 'admin-user');
      ok(result.granted, 'access granted');
      strictEqual(result.level, 'admin');
    });

    it('grants write access to mod user', () => {
      const result = ac.check('telegram', 'mod-user');
      ok(result.granted, 'access granted');
      strictEqual(result.level, 'write');
    });

    it('grants default access to unknown user', () => {
      const result = ac.check('telegram', 'unknown-user');
      ok(result.granted, 'access granted');
      strictEqual(result.level, 'read');
    });

    it('denies access when denyByDefault enabled', () => {
      const denyAc = new AccessControl({ ...defaultConfig, denyByDefault: true });
      const result = denyAc.check('telegram', 'unknown-user');
      ok(!result.granted, 'access denied');
      strictEqual(result.level, 'none');
    });

    it('respects channel-specific rules', () => {
      const result = ac.check('discord', 'discord-admin');
      ok(result.granted, 'access granted');
      strictEqual(result.level, 'admin');
    });

    it('applies channel-wide rules', () => {
      const result = ac.check('slack', 'any-user');
      ok(result.granted, 'access granted');
      strictEqual(result.level, 'read');
    });
  });

  describe('resource access', () => {
    it('checks resource-specific access', () => {
      const resourceAc = new AccessControl({
        ...defaultConfig,
        rules: [
          { user: 'admin-user', level: 'admin', resources: ['settings', 'users'] },
          { user: 'viewer', level: 'read', resources: ['logs'] },
        ],
      });

      const adminResult = resourceAc.checkResource('admin-user', 'settings');
      ok(adminResult.granted, 'admin can access settings');

      const viewerResult = resourceAc.checkResource('viewer', 'logs');
      ok(viewerResult.granted, 'viewer can access logs');

      const deniedResult = resourceAc.checkResource('viewer', 'settings');
      ok(!deniedResult.granted, 'viewer cannot access settings');
    });
  });

  describe('addRule', () => {
    it('adds new rules dynamically', () => {
      ac.addRule({ channel: 'web', user: 'web-admin', level: 'admin' });

      const result = ac.check('web', 'web-admin');
      ok(result.granted, 'access granted');
      strictEqual(result.level, 'admin');
    });
  });

  describe('removeRule', () => {
    it('removes existing rules', () => {
      ac.removeRule('telegram', 'admin-user');

      const result = ac.check('telegram', 'admin-user');
      strictEqual(result.level, 'read'); // falls back to default
    });
  });
});
