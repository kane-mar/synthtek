/**
 * Feishu/Lark Channel Tests
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { FeishuChannel } from '../../src/channels/feishu/channel.js';
import type {
  FeishuConfig,
  FeishuSendOptions,
  FeishuHealthStatus,
} from '../../src/channels/feishu/types.js';

describe('Feishu/Lark Channel', () => {
  const testConfig: FeishuConfig = {
    appId: 'cli_test_app_id',
    appSecret: 'test_app_secret',
    useGlobalDomain: false,
    maxRetries: 3,
    retryDelay: 100,
  };

  let channel: FeishuChannel;

  before(() => {
    channel = new FeishuChannel(testConfig);
  });

  after(async () => {
    await channel.disconnect();
  });

  describe('constructor', () => {
    it('should create channel with config', () => {
      assert.ok(channel);
    });

    it('should apply defaults', () => {
      const c = new FeishuChannel({ appId: 'id', appSecret: 'secret' });
      const config = c.getConfig();
      assert.equal(config.useGlobalDomain, false);
      assert.equal(config.maxRetries, 3);
      assert.equal(config.retryDelay, 1000);
    });
  });

  describe('getConfig', () => {
    it('should return config', () => {
      const config = channel.getConfig();
      assert.equal(config.appId, 'cli_test_app_id');
    });
  });

  describe('updateConfig', () => {
    it('should update config', () => {
      channel.updateConfig({ useGlobalDomain: true });
      assert.equal(channel.getConfig().useGlobalDomain, true);
    });
  });

  describe('isConnected', () => {
    it('should return false initially', () => {
      assert.equal(channel.isConnected(), false);
    });
  });

  describe('connect', () => {
    it('should throw when auth fails', async () => {
      const bad = new FeishuChannel({ appId: 'invalid', appSecret: 'invalid' });
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
    it('should throw when not connected', async () => {
      const opts: FeishuSendOptions = {
        receiveId: 'oc_test',
        msgType: 'text',
        content: 'Hello',
      };
      await assert.rejects(channel.sendMessage(opts));
    });
  });

  describe('sendCard', () => {
    it('should return error when not connected', async () => {
      const result = await channel.sendCard({
        receiveId: 'oc_test',
        card: { config: {} },
      });
      assert.equal(result.success, false);
    });
  });

  describe('getUserInfo', () => {
    it('should throw when not connected', async () => {
      await assert.rejects(channel.getUserInfo('user_id'));
    });
  });

  describe('getChatInfo', () => {
    it('should throw when not connected', async () => {
      await assert.rejects(channel.getChatInfo('chat_id'));
    });
  });

  describe('startWebhook', () => {
    it('should throw when not connected', async () => {
      await assert.rejects(channel.startWebhook());
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
      const status: FeishuHealthStatus = channel.getHealthStatus();
      assert.equal(status.connected, false);
      assert.equal(status.messagesSent, 0);
      assert.equal(status.messagesReceived, 0);
    });
  });
});
