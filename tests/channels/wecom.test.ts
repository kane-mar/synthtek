/**
 * WeCom Channel Tests
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { WeComChannel } from '../../src/channels/wecom/channel.js';
import type { WeComConfig, WeComSendOptions, WeComHealthStatus } from '../../src/channels/wecom/types.js';

describe('WeCom Channel', () => {
  const testConfig: WeComConfig = {
    corpId: 'test_corp_id',
    agentId: 1000001,
    agentSecret: 'test_secret',
    maxRetries: 3,
    retryDelay: 100,
  };

  let channel: WeComChannel;

  before(() => {
    channel = new WeComChannel(testConfig);
  });

  after(async () => {
    await channel.disconnect();
  });

  describe('constructor', () => {
    it('should create channel with config', () => {
      assert.ok(channel);
    });

    it('should apply defaults', () => {
      const c = new WeComChannel({ corpId: 'id', agentId: 1, agentSecret: 's' });
      const config = c.getConfig();
      assert.equal(config.apiBaseUrl, 'https://qyapi.weixin.qq.com');
      assert.equal(config.maxRetries, 3);
    });
  });

  describe('getConfig', () => {
    it('should return config', () => {
      const config = channel.getConfig();
      assert.equal(config.corpId, 'test_corp_id');
      assert.equal(config.agentId, 1000001);
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
      const bad = new WeComChannel({ corpId: 'invalid', agentId: 1, agentSecret: 'invalid' });
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
      const opts: WeComSendOptions = {
        userIds: ['user1'],
        msgType: 'text',
        content: 'Hello',
      };
      const result = await channel.sendMessage(opts);
      assert.equal(result.success, false);
    });

    it('should accept array of user IDs', async () => {
      const result = await channel.sendMessage({
        userIds: ['user1', 'user2'],
        msgType: 'text',
        content: 'Hello',
      });
      assert.equal(result.success, false);
    });

    it('should accept markdown messages', async () => {
      const result = await channel.sendMessage({
        userIds: 'user1',
        msgType: 'markdown',
        content: '**Bold** text',
      });
      assert.equal(result.success, false);
    });

    it('should accept media messages', async () => {
      const result = await channel.sendMessage({
        userIds: 'user1',
        msgType: 'image',
        mediaId: 'media_id_123',
      });
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
      const status: WeComHealthStatus = channel.getHealthStatus();
      assert.equal(status.connected, false);
      assert.equal(status.messagesSent, 0);
    });
  });
});
