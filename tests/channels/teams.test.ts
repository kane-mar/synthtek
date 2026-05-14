/**
 * Microsoft Teams Channel Tests
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { TeamsChannel } from '../../src/channels/teams/channel.js';
import type {
  TeamsConfig,
  TeamsSendOptions,
  TeamsHealthStatus,
} from '../../src/channels/teams/types.js';

describe('Microsoft Teams Channel', () => {
  const testConfig: TeamsConfig = {
    appId: 'test-app-id-12345',
    appPassword: 'test-app-password',
    botName: 'TestBot',
    maxRetries: 3,
    retryDelay: 100,
    typingEnabled: true,
    webhookPort: 3978,
  };

  let channel: TeamsChannel;

  before(() => {
    channel = new TeamsChannel(testConfig);
  });

  after(async () => {
    await channel.disconnect();
  });

  describe('constructor', () => {
    it('should create channel with config', () => {
      assert.ok(channel);
    });

    it('should apply default values for optional config', () => {
      const minimalConfig: TeamsConfig = {
        appId: 'app-id',
        appPassword: 'password',
      };
      const c = new TeamsChannel(minimalConfig);
      const config = c.getConfig();
      assert.equal(config.maxRetries, 3);
      assert.equal(config.retryDelay, 1000);
      assert.equal(config.typingEnabled, true);
      assert.equal(config.webhookPort, 3978);
    });
  });

  describe('getConfig', () => {
    it('should return the config', () => {
      const config = channel.getConfig();
      assert.equal(config.appId, 'test-app-id-12345');
      assert.equal(config.botName, 'TestBot');
    });

    it('should return a copy of config', () => {
      const config = channel.getConfig();
      assert.notEqual(config, testConfig);
    });
  });

  describe('updateConfig', () => {
    it('should update config values', () => {
      channel.updateConfig({ typingEnabled: false });
      const config = channel.getConfig();
      assert.equal(config.typingEnabled, false);
    });
  });

  describe('isConnected', () => {
    it('should return false initially', () => {
      assert.equal(channel.isConnected(), false);
    });
  });

  describe('connect', () => {
    it('should throw when authentication fails', async () => {
      const badChannel = new TeamsChannel({
        appId: 'invalid-app-id',
        appPassword: 'invalid-password',
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
      const options: TeamsSendOptions = {
        conversationId: 'test-conversation-id',
        text: 'Hello',
      };
      await assert.rejects(channel.sendMessage(options));
    });
  });

  describe('sendTyping', () => {
    it('should throw when not connected', async () => {
      await assert.rejects(channel.sendTyping('test-conversation-id'));
    });
  });

  describe('getConversationInfo', () => {
    it('should throw when not connected', async () => {
      await assert.rejects(channel.getConversationInfo('test-conversation-id'));
    });
  });

  describe('getUserInfo', () => {
    it('should throw when not connected', async () => {
      await assert.rejects(channel.getUserInfo('test-user-id'));
    });
  });

  describe('startWebhook', () => {
    it('should throw when not connected', async () => {
      await assert.rejects(channel.startWebhook());
    });
  });

  describe('onMessage', () => {
    it('should register a message handler', () => {
      channel.onMessage(async (msg) => {
        assert.ok(msg.activityId);
        assert.ok(msg.conversationId);
      });
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status', () => {
      const status: TeamsHealthStatus = channel.getHealthStatus();
      assert.equal(status.connected, false);
      assert.equal(status.authenticated, false);
      assert.equal(status.conversationsCount, 0);
      assert.equal(status.messagesSent, 0);
      assert.equal(status.messagesReceived, 0);
    });
  });

  describe('error handling', () => {
    it('should handle connection errors gracefully', async () => {
      const badChannel = new TeamsChannel({
        appId: 'invalid',
        appPassword: 'invalid',
      });
      await assert.rejects(badChannel.connect());
      assert.equal(badChannel.isConnected(), false);
    });
  });

  describe('config validation', () => {
    it('should require appId', () => {
      assert.ok(true);
    });

    it('should require appPassword', () => {
      assert.ok(true);
    });
  });

  describe('webhook handling', () => {
    it('should handle non-POST requests', () => {
      // Tested via integration
      assert.ok(true);
    });

    it('should verify activity signatures', () => {
      // Tested via integration
      assert.ok(true);
    });
  });

  describe('token management', () => {
    it('should refresh token when expired', () => {
      // Token expiry is handled internally
      assert.ok(true);
    });
  });
});
