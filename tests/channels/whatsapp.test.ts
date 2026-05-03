/**
 * WhatsApp Channel Tests
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { WhatsAppChannel } from '../../src/channels/whatsapp/channel.js';
import type {
  WhatsAppConfig,
  WhatsAppSendOptions,
  WhatsAppSendResult,
  WhatsAppHealthStatus,
} from '../../src/channels/whatsapp/types.js';

describe('WhatsApp Channel', () => {
  const testConfig: WhatsAppConfig = {
    phoneNumberId: 'test-phone-number-id',
    businessId: 'test-business-id',
    accessToken: 'test-access-token',
    apiBaseUrl: 'https://graph.facebook.com',
    apiVersion: 'v18.0',
    maxRetries: 3,
    retryDelay: 100,
    typingEnabled: true,
  };

  let channel: WhatsAppChannel;

  before(() => {
    channel = new WhatsAppChannel(testConfig);
  });

  after(async () => {
    await channel.disconnect();
  });

  describe('constructor', () => {
    it('should create channel with config', () => {
      assert.ok(channel);
    });

    it('should apply default values', () => {
      const minimalConfig: WhatsAppConfig = {
        phoneNumberId: 'id',
        businessId: 'biz',
        accessToken: 'token',
      };
      const c = new WhatsAppChannel(minimalConfig);
      const config = c.getConfig();
      assert.equal(config.apiBaseUrl, 'https://graph.facebook.com');
      assert.equal(config.apiVersion, 'v18.0');
      assert.equal(config.maxRetries, 3);
      assert.equal(config.retryDelay, 1000);
    });
  });

  describe('getConfig', () => {
    it('should return the config', () => {
      const config = channel.getConfig();
      assert.equal(config.phoneNumberId, 'test-phone-number-id');
      assert.equal(config.businessId, 'test-business-id');
    });

    it('should return a copy', () => {
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
    it('should throw when verification fails', async () => {
      const badChannel = new WhatsAppChannel({
        phoneNumberId: 'invalid',
        businessId: 'invalid',
        accessToken: 'invalid',
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
    it('should return error when not connected', async () => {
      const options: WhatsAppSendOptions = {
        to: '+1234567890',
        type: 'text',
        text: 'Hello',
      };
      const result: WhatsAppSendResult = await channel.sendMessage(options);
      assert.equal(result.success, false);
      assert.ok(result.error);
    });

    it('should accept text messages', async () => {
      const result = await channel.sendMessage({
        to: '+1234567890',
        type: 'text',
        text: 'Hello',
        previewUrl: true,
      });
      assert.equal(result.success, false);
    });

    it('should accept template messages', async () => {
      const result = await channel.sendMessage({
        to: '+1234567890',
        type: 'template',
        templateName: 'hello_world',
        templateComponents: [],
      });
      assert.equal(result.success, false);
    });

    it('should accept media messages', async () => {
      const result = await channel.sendMessage({
        to: '+1234567890',
        type: 'image',
        mediaId: 'media-id-123',
        caption: 'Test image',
      });
      assert.equal(result.success, false);
    });

    it('should accept reply messages', async () => {
      const result = await channel.sendMessage({
        to: '+1234567890',
        type: 'text',
        text: 'Reply',
        replyTo: 'msg-id-123',
      });
      assert.equal(result.success, false);
    });
  });

  describe('webhook', () => {
    it('should throw when not connected', async () => {
      await assert.rejects(channel.startWebhook());
    });
  });

  describe('onMessage', () => {
    it('should register a message handler', () => {
      channel.onMessage(async (msg) => {
        assert.ok(msg.messageId);
        assert.ok(msg.from);
      });
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status', () => {
      const status: WhatsAppHealthStatus = channel.getHealthStatus();
      assert.equal(status.connected, false);
      assert.equal(status.phoneNumberStatus, 'disconnected');
      assert.equal(status.messagesSent, 0);
      assert.equal(status.messagesReceived, 0);
      assert.equal(status.webhookActive, false);
    });
  });

  describe('error handling', () => {
    it('should handle connection errors gracefully', async () => {
      const badChannel = new WhatsAppChannel({
        phoneNumberId: 'invalid',
        businessId: 'invalid',
        accessToken: 'invalid',
      });
      await assert.rejects(badChannel.connect());
    });
  });
});
