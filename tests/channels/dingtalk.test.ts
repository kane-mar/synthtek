/**
 * DingTalk Channel Tests
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DingTalkChannel } from '../../src/channels/dingtalk/channel.js';
import type { DingTalkConfig, DingTalkSendOptions, DingTalkHealthStatus } from '../../src/channels/dingtalk/types.js';

describe('DingTalk Channel', () => {
  const testConfig: DingTalkConfig = {
    clientId: 'test_client_id',
    clientSecret: 'test_secret',
    maxRetries: 3,
    retryDelay: 100,
  };

  let channel: DingTalkChannel;

  before(() => {
    channel = new DingTalkChannel(testConfig);
  });

  after(async () => {
    await channel.disconnect();
  });

  describe('constructor', () => {
    it('should create channel with config', () => {
      assert.ok(channel);
    });

    it('should apply defaults', () => {
      const c = new DingTalkChannel({ clientId: 'id', clientSecret: 's' });
      const config = c.getConfig();
      assert.equal(config.maxRetries, 3);
      assert.equal(config.retryDelay, 1000);
    });
  });

  describe('getConfig', () => {
    it('should return config', () => {
      const config = channel.getConfig();
      assert.equal(config.clientId, 'test_client_id');
    });
  });

  describe('updateConfig', () => {
    it('should update config', () => {
      channel.updateConfig({ maxRetries: 5 });
      assert.equal(channel.getConfig().maxRetries, 5);
    });
  });

  describe('isConnected', () => {
    it('should return false initially', () => {
      assert.equal(channel.isConnected(), false);
    });
  });

  describe('connect', () => {
    it('should throw when auth fails', async () => {
      const bad = new DingTalkChannel({ clientId: 'invalid', clientSecret: 'invalid' });
      await assert.rejects(bad.connect());
    });
  });

  describe('disconnect', () => {
    it('should set connected to false', async () => {
      await channel.disconnect();
      assert.equal(channel.isConnected(), false);
    });
  });

  describe('sendMessage', () => {
    it('should return error when not connected', async () => {
      const opts: DingTalkSendOptions = {
        conversationId: 'cid',
        msgKey: 'text',
        msgData: '{"text":"Hello"}',
      };
      const result = await channel.sendMessage(opts);
      assert.equal(result.success, false);
    });
  });

  describe('onMessage', () => {
    it('should register handler', () => {
      channel.onMessage(async (msg) => {
        assert.ok(msg.messageId);
      });
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status', () => {
      const status: DingTalkHealthStatus = channel.getHealthStatus();
      assert.equal(status.connected, false);
      assert.equal(status.messagesSent, 0);
    });
  });
});
