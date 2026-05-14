/**
 * Tests for WeChat Channel
 */

import { describe, it, beforeEach } from 'node:test';
import { ok, strictEqual } from 'node:assert';
import { WeChatChannel } from '../../src/channels/wechat/channel.js';
import type { WeChatConfig, WeChatSendOptions } from '../../src/channels/wechat/types.js';

const defaultConfig: WeChatConfig = {
  appId: 'wx_test_app',
  appSecret: 'test_secret',
  token: 'test_token',
  encodingAESKey: 'test_aes_key',
};

describe('WeChatChannel', () => {
  let channel: WeChatChannel;

  beforeEach(() => {
    channel = new WeChatChannel(defaultConfig);
  });

  describe('constructor', () => {
    it('creates channel with config', () => {
      strictEqual(channel.name, 'wechat');
    });

    it('starts in disconnected state', () => {
      strictEqual(channel.status, 'disconnected');
    });
  });

  describe('message handling', () => {
    it('parses incoming text message', () => {
      const rawMsg = {
        ToUserName: 'bot',
        FromUserName: 'user123',
        MsgType: 'text',
        Content: 'Hello bot',
        CreateTime: Date.now(),
        MsgId: 'msg_001',
      };

      const parsed = channel.parseMessage(rawMsg);
      ok(parsed, 'message parsed');
      strictEqual(parsed.role, 'user');
      strictEqual(parsed.content, 'Hello bot');
      strictEqual(parsed.userId, 'user123');
    });

    it('parses incoming image message', () => {
      const rawMsg = {
        ToUserName: 'bot',
        FromUserName: 'user456',
        MsgType: 'image',
        MediaId: 'img_001',
        CreateTime: Date.now(),
        MsgId: 'msg_002',
      };

      const parsed = channel.parseMessage(rawMsg);
      ok(parsed, 'image message parsed');
      strictEqual(parsed.role, 'user');
      strictEqual(parsed.mediaType, 'image');
      strictEqual(parsed.mediaId, 'img_001');
    });

    it('parses incoming voice message', () => {
      const rawMsg = {
        ToUserName: 'bot',
        FromUserName: 'user789',
        MsgType: 'voice',
        MediaId: 'voice_001',
        Format: 'amr',
        CreateTime: Date.now(),
        MsgId: 'msg_003',
      };

      const parsed = channel.parseMessage(rawMsg);
      ok(parsed, 'voice message parsed');
      strictEqual(parsed.role, 'user');
      strictEqual(parsed.mediaType, 'audio');
      strictEqual(parsed.mediaFormat, 'amr');
    });

    it('parses incoming video message', () => {
      const rawMsg = {
        ToUserName: 'bot',
        FromUserName: 'user101',
        MsgType: 'video',
        MediaId: 'video_001',
        ThumbMediaId: 'thumb_001',
        CreateTime: Date.now(),
        MsgId: 'msg_004',
      };

      const parsed = channel.parseMessage(rawMsg);
      ok(parsed, 'video message parsed');
      strictEqual(parsed.role, 'user');
      strictEqual(parsed.mediaType, 'video');
    });
  });

  describe('message sending', () => {
    it('builds text message payload', () => {
      const payload = channel.buildPayload('user123', 'Hello there', {});
      strictEqual(payload.touser, 'user123');
      strictEqual(payload.msgtype, 'text');
      ok(payload.text, 'has text object');
      strictEqual(payload.text.content, 'Hello there');
    });

    it('builds image message payload', () => {
      const payload = channel.buildPayload('user123', '', {
        mediaType: 'image',
        mediaId: 'img_002',
      } as WeChatSendOptions);
      strictEqual(payload.touser, 'user123');
      strictEqual(payload.msgtype, 'image');
       strictEqual(payload.image!.media_id, 'img_002');
    });

    it('builds voice message payload', () => {
      const payload = channel.buildPayload('user123', '', {
        mediaType: 'audio',
        mediaId: 'voice_002',
      } as WeChatSendOptions);
      strictEqual(payload.touser, 'user123');
      strictEqual(payload.msgtype, 'voice');
       strictEqual(payload.voice!.media_id, 'voice_002');
    });

    it('builds video message payload', () => {
      const payload = channel.buildPayload('user123', '', {
        mediaType: 'video',
        mediaId: 'video_002',
        thumbMediaId: 'thumb_002',
      } as WeChatSendOptions);
      strictEqual(payload.touser, 'user123');
      strictEqual(payload.msgtype, 'video');
       strictEqual(payload.video!.media_id, 'video_002');
      strictEqual(payload.video!.thumb_media_id, 'thumb_002');
    });

    it('builds textcard message payload', () => {
      const payload = channel.buildPayload('user123', '', {
        mediaType: 'textcard',
        title: 'Alert',
        description: 'Something happened',
      } as WeChatSendOptions);
      strictEqual(payload.touser, 'user123');
      strictEqual(payload.msgtype, 'textcard');
       strictEqual(payload.textcard!.title, 'Alert');
      strictEqual(payload.textcard!.description, 'Something happened');
    });
  });

  describe('long message splitting', () => {
    it('splits messages exceeding 2048 character limit', () => {
      const longText = 'a'.repeat(3000);
      const chunks = channel.splitMessage(longText);
      ok(chunks.length > 1, 'split into multiple chunks');
      for (const chunk of chunks) {
        ok(chunk.length <= 2048, 'each chunk within limit');
      }
    });

    it('returns single chunk for short messages', () => {
      const shortText = 'Hello';
      const chunks = channel.splitMessage(shortText);
      strictEqual(chunks.length, 1);
      strictEqual(chunks[0], shortText);
    });
  });

  describe('typing indicators', () => {
    it('supports typing indicator', () => {
      ok(typeof channel.sendTypingIndicator === 'function', 'has sendTypingIndicator');
    });
  });

  describe('group chat support', () => {
    it('handles group messages', () => {
      const rawMsg = {
        ToUserName: 'bot',
        FromUserName: 'group_001',
        MsgType: 'text',
        Content: 'Group message',
        CreateTime: Date.now(),
        MsgId: 'msg_grp_001',
        IsGroup: true,
      };

      const parsed = channel.parseMessage(rawMsg);
      ok(parsed, 'group message parsed');
      ok(parsed.isGroup, 'marked as group message');
    });
  });

  describe('health check', () => {
    it('returns health status', () => {
      const health = channel.healthCheck();
      ok(health, 'health check returns result');
      strictEqual(health.name, 'wechat');
    });

    it('returns stats', () => {
      const stats = channel.getStats();
      ok(stats, 'stats returned');
      strictEqual(stats.messagesReceived, 0);
      strictEqual(stats.messagesSent, 0);
    });
  });

  describe('media resilience', () => {
    it('handles missing media gracefully', () => {
      const rawMsg = {
        ToUserName: 'bot',
        FromUserName: 'user123',
        MsgType: 'image',
        CreateTime: Date.now(),
        MsgId: 'msg_no_media',
      };

      const parsed = channel.parseMessage(rawMsg);
      ok(parsed, 'parsed without media');
      strictEqual(parsed.mediaId, undefined);
    });
  });

  describe('QR code login', () => {
    it('generates QR code URL', () => {
      const qrUrl = channel.generateQRCodeUrl();
      ok(typeof qrUrl === 'string', 'QR URL is string');
      ok(qrUrl.includes('wx_test_app'), 'includes app ID');
    });
  });
});
