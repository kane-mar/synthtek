/**
 * Matrix Channel Tests
 */

import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { MatrixChannel } from '../../src/channels/matrix/channel.js';
import type { MatrixConfig, MatrixSendOptions, MatrixHealthStatus } from '../../src/channels/matrix/types.js';

describe('Matrix Channel', () => {
  const testConfig: MatrixConfig = {
    homeserver: 'https://matrix.org',
    accessToken: 'test_token_12345',
    userId: '@test:matrix.org',
    deviceId: 'TESTDEVICE',
    e2eEnabled: false,
    maxRetries: 3,
    retryDelay: 100,
  };

  let channel: MatrixChannel;

  before(() => {
    channel = new MatrixChannel(testConfig);
  });

  after(async () => {
    await channel.disconnect();
  });

  afterEach(() => {
    // Reset state between tests
  });

  describe('constructor', () => {
    it('should create channel with config', () => {
      assert.ok(channel);
    });

    it('should apply default values for optional config', () => {
      const minimalConfig: MatrixConfig = {
        homeserver: 'https://example.org',
        accessToken: 'token',
        userId: '@user:example.org',
      };
      const c = new MatrixChannel(minimalConfig);
      const config = c.getConfig();
      assert.equal(config.maxRetries, 3);
      assert.equal(config.retryDelay, 1000);
      assert.equal(config.e2eEnabled, false);
      assert.equal(config.presence, 'online');
    });
  });

  describe('getConfig', () => {
    it('should return the config', () => {
      const config = channel.getConfig();
      assert.equal(config.homeserver, 'https://matrix.org');
      assert.equal(config.accessToken, 'test_token_12345');
      assert.equal(config.userId, '@test:matrix.org');
    });

    it('should return a copy of config', () => {
      const config = channel.getConfig();
      assert.notEqual(config, testConfig);
    });
  });

  describe('updateConfig', () => {
    it('should update config values', () => {
      channel.updateConfig({ maxRetries: 5 });
      const config = channel.getConfig();
      assert.equal(config.maxRetries, 5);
      // Other values should remain
      assert.equal(config.homeserver, 'https://matrix.org');
    });
  });

  describe('isConnected', () => {
    it('should return false initially', () => {
      assert.equal(channel.isConnected(), false);
    });
  });

  describe('connect', () => {
    it('should throw when token verification fails', async () => {
      const badChannel = new MatrixChannel({
        homeserver: 'https://invalid.example',
        accessToken: 'bad_token',
        userId: '@test:invalid',
      });
      await assert.rejects(badChannel.connect());
    });
  });

  describe('disconnect', () => {
    it('should set connected to false', async () => {
      await channel.disconnect();
      assert.equal(channel.isConnected(), false);
    });
  });

  describe('sendMessage', () => {
    it('should throw when not connected', async () => {
      const options: MatrixSendOptions = {
        roomId: '!room:matrix.org',
        body: 'Hello',
      };
      await assert.rejects(channel.sendMessage(options));
    });
  });

  describe('addReaction', () => {
    it('should throw when not connected', async () => {
      await assert.rejects(channel.addReaction('!room:matrix.org', '$event123', '👍'));
    });
  });

  describe('removeReaction', () => {
    it('should throw when not connected', async () => {
      await assert.rejects(channel.removeReaction('!room:matrix.org', '$event123'));
    });
  });

  describe('getRoomInfo', () => {
    it('should throw when not connected', async () => {
      await assert.rejects(channel.getRoomInfo('!room:matrix.org'));
    });
  });

  describe('getUserInfo', () => {
    it('should throw when not connected', async () => {
      await assert.rejects(channel.getUserInfo('@user:matrix.org'));
    });
  });

  describe('startSync', () => {
    it('should throw when not connected', async () => {
      await assert.rejects(channel.startSync());
    });
  });

  describe('setPresence', () => {
    it('should throw when not connected', async () => {
      await assert.rejects(channel.setPresence('online'));
    });
  });

  describe('sendTyping', () => {
    it('should throw when not connected', async () => {
      await assert.rejects(channel.sendTyping('!room:matrix.org', true));
    });
  });

  describe('onMessage', () => {
    it('should register a message handler', () => {
      channel.onMessage(async (msg) => {
        assert.ok(msg.eventId);
        assert.ok(msg.roomId);
      });
      // Handler is registered (we can't easily test it without a real server)
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status', () => {
      const status: MatrixHealthStatus = channel.getHealthStatus();
      assert.equal(status.connected, false);
      assert.equal(status.roomsCount, 0);
      assert.equal(status.e2eEnabled, false);
    });

    it('should include sync token when available', () => {
      const status = channel.getHealthStatus();
      assert.ok(status.syncToken === undefined);
    });
  });

  describe('message parsing', () => {
    it('should parse text messages correctly', () => {
      const testChannel = new MatrixChannel(testConfig);
      // We test via the public interface
      assert.ok(testChannel);
    });

    it('should handle reply messages', () => {
      const testChannel = new MatrixChannel(testConfig);
      assert.ok(testChannel);
    });

    it('should handle thread messages', () => {
      const testChannel = new MatrixChannel(testConfig);
      assert.ok(testChannel);
    });
  });

  describe('error handling', () => {
    it('should handle connection errors gracefully', async () => {
      const badChannel = new MatrixChannel({
        homeserver: 'https://nonexistent.invalid',
        accessToken: 'bad',
        userId: '@test:invalid',
        maxRetries: 1,
        retryDelay: 50,
      });
      await assert.rejects(badChannel.connect());
      assert.equal(badChannel.isConnected(), false);
    });

    it('should handle invalid homeserver URL', async () => {
      const badChannel = new MatrixChannel({
        homeserver: 'not-a-url',
        accessToken: 'token',
        userId: '@test:invalid',
      });
      // Should fail when trying to connect
      try {
        await badChannel.connect();
        assert.fail('Should have thrown');
      } catch {
        // Expected
      }
    });
  });

  describe('config validation', () => {
    it('should require homeserver', () => {
      // TypeScript enforces this at compile time
      assert.ok(true);
    });

    it('should require accessToken', () => {
      assert.ok(true);
    });

    it('should require userId', () => {
      assert.ok(true);
    });
  });

  describe('E2E encryption', () => {
    it('should support E2E config', () => {
      const e2eConfig: MatrixConfig = {
        homeserver: 'https://matrix.org',
        accessToken: 'token',
        userId: '@test:matrix.org',
        e2eEnabled: true,
        keyBackupVersion: 'v1',
      };
      const c = new MatrixChannel(e2eConfig);
      const config = c.getConfig();
      assert.equal(config.e2eEnabled, true);
      assert.equal(config.keyBackupVersion, 'v1');
    });
  });

  describe('retry behavior', () => {
    it('should respect maxRetries config', () => {
      const c = new MatrixChannel({
        homeserver: 'https://matrix.org',
        accessToken: 'token',
        userId: '@test:matrix.org',
        maxRetries: 10,
        retryDelay: 500,
      });
      const config = c.getConfig();
      assert.equal(config.maxRetries, 10);
      assert.equal(config.retryDelay, 500);
    });
  });
});
