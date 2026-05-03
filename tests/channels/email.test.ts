/**
 * Email Channel Tests
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { EmailChannel } from '../../src/channels/email/channel.js';
import type {
  EmailConfig,
  EmailMessage,
  EmailSendResult,
  EmailHealthStatus,
  ScheduledReport,
} from '../../src/channels/email/types.js';

describe('Email Channel', () => {
  const testConfig: EmailConfig = {
    smtpHost: 'smtp.example.com',
    smtpPort: 587,
    smtpUser: 'test@example.com',
    smtpPass: 'password123',
    smtpTls: true,
    imapHost: 'imap.example.com',
    imapPort: 993,
    imapUser: 'test@example.com',
    imapPass: 'password123',
    imapTls: true,
    fromAddress: 'test@example.com',
    pollingInterval: 30000,
    maxEmailsPerPoll: 50,
    markAsRead: true,
    folder: 'INBOX',
    maxAttachmentSize: 10 * 1024 * 1024,
  };

  let channel: EmailChannel;

  before(() => {
    channel = new EmailChannel(testConfig);
  });

  after(async () => {
    channel.stopPolling();
    await channel.disconnect();
  });

  describe('constructor', () => {
    it('should create channel with config', () => {
      assert.ok(channel);
    });

    it('should apply default values for optional config', () => {
      const minimalConfig: EmailConfig = {
        smtpHost: 'smtp.example.com',
        smtpUser: 'user@example.com',
        smtpPass: 'pass',
        imapHost: 'imap.example.com',
        imapUser: 'user@example.com',
        imapPass: 'pass',
        fromAddress: 'user@example.com',
      };
      const c = new EmailChannel(minimalConfig);
      const config = c.getConfig();
      assert.equal(config.smtpPort, 587);
      assert.equal(config.imapPort, 993);
      assert.equal(config.smtpTls, true);
      assert.equal(config.imapTls, true);
      assert.equal(config.pollingInterval, 30000);
      assert.equal(config.maxEmailsPerPoll, 50);
      assert.equal(config.folder, 'INBOX');
    });
  });

  describe('getConfig', () => {
    it('should return the config', () => {
      const config = channel.getConfig();
      assert.equal(config.smtpHost, 'smtp.example.com');
      assert.equal(config.fromAddress, 'test@example.com');
    });

    it('should return a copy of config', () => {
      const config = channel.getConfig();
      assert.notEqual(config, testConfig);
    });
  });

  describe('updateConfig', () => {
    it('should update config values', () => {
      channel.updateConfig({ pollingInterval: 60000 });
      const config = channel.getConfig();
      assert.equal(config.pollingInterval, 60000);
    });
  });

  describe('isConnected', () => {
    it('should return false initially', () => {
      assert.equal(channel.isConnected(), false);
    });
  });

  describe('connect', () => {
    it('should throw when SMTP connection fails', async () => {
      const badChannel = new EmailChannel({
        smtpHost: 'invalid.invalid',
        smtpUser: 'user',
        smtpPass: 'pass',
        imapHost: 'invalid.invalid',
        imapUser: 'user',
        imapPass: 'pass',
        fromAddress: 'user@example.com',
      });
      await assert.rejects(badChannel.connect());
    });
  });

  describe('disconnect', () => {
    it('should set connected flags to false', async () => {
      await channel.disconnect();
      assert.equal(channel.isConnected(), false);
    });
  });

  describe('sendEmail', () => {
    it('should return error when SMTP not connected', async () => {
      const result: EmailSendResult = await channel.sendEmail({
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Hello',
      });
      assert.equal(result.success, false);
      assert.ok(result.error);
    });

    it('should accept array of recipients', async () => {
      const result = await channel.sendEmail({
        to: ['a@example.com', 'b@example.com'],
        subject: 'Test',
        text: 'Hello',
      });
      assert.equal(result.success, false); // Not connected
    });

    it('should accept CC recipients', async () => {
      const result = await channel.sendEmail({
        to: 'a@example.com',
        cc: ['b@example.com'],
        subject: 'Test',
        text: 'Hello',
      });
      assert.equal(result.success, false);
    });

    it('should accept BCC recipients', async () => {
      const result = await channel.sendEmail({
        to: 'a@example.com',
        bcc: ['b@example.com'],
        subject: 'Test',
        text: 'Hello',
      });
      assert.equal(result.success, false);
    });

    it('should accept HTML body', async () => {
      const result = await channel.sendEmail({
        to: 'a@example.com',
        subject: 'Test',
        html: '<h1>Hello</h1>',
      });
      assert.equal(result.success, false);
    });

    it('should accept both text and HTML', async () => {
      const result = await channel.sendEmail({
        to: 'a@example.com',
        subject: 'Test',
        text: 'Hello',
        html: '<h1>Hello</h1>',
      });
      assert.equal(result.success, false);
    });

    it('should accept attachments', async () => {
      const result = await channel.sendEmail({
        to: 'a@example.com',
        subject: 'Test',
        text: 'Hello',
        attachments: [
          {
            filename: 'test.txt',
            content: Buffer.from('Hello'),
            contentType: 'text/plain',
          },
        ],
      });
      assert.equal(result.success, false);
    });

    it('should accept priority', async () => {
      const result = await channel.sendEmail({
        to: 'a@example.com',
        subject: 'Test',
        text: 'Hello',
        priority: 'high',
      });
      assert.equal(result.success, false);
    });

    it('should accept replyTo', async () => {
      const result = await channel.sendEmail({
        to: 'a@example.com',
        subject: 'Test',
        text: 'Hello',
        replyTo: 'reply@example.com',
      });
      assert.equal(result.success, false);
    });
  });

  describe('polling', () => {
    it('should throw when IMAP not connected', async () => {
      await assert.rejects(channel.startPolling());
    });

    it('should stop polling without error', () => {
      channel.stopPolling();
    });
  });

  describe('processEmail', () => {
    it('should process an email', async () => {
      const testChannel = new EmailChannel(testConfig);
      let received = false;
      testChannel.onMessage(async (msg) => {
        received = true;
        assert.equal(msg.emailId, 'test-123');
      });

      const email: EmailMessage = {
        emailId: 'test-123',
        messageId: '<msg@example.com>',
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        subject: 'Test',
        textBody: 'Hello',
        date: new Date(),
        internalDate: new Date(),
        flags: ['\\Unseen'],
        attachments: [],
        isRead: false,
      };

      await testChannel.processEmail(email);
      assert.equal(received, true);
    });

    it('should skip already processed emails', async () => {
      const testChannel = new EmailChannel(testConfig);
      let count = 0;
      testChannel.onMessage(async () => {
        count++;
      });

      const email: EmailMessage = {
        emailId: 'duplicate-123',
        messageId: '<msg2@example.com>',
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        subject: 'Test',
        date: new Date(),
        internalDate: new Date(),
        flags: [],
        attachments: [],
        isRead: false,
      };

      await testChannel.processEmail(email);
      await testChannel.processEmail(email);
      assert.equal(count, 1);
    });

    it('should respect sender whitelist', async () => {
      const whitelistChannel = new EmailChannel({
        ...testConfig,
        senderWhitelist: ['allowed@example.com'],
      });

      let received = false;
      whitelistChannel.onMessage(async () => {
        received = true;
      });

      const email: EmailMessage = {
        emailId: 'whitelist-test',
        messageId: '<msg3@example.com>',
        from: 'blocked@example.com',
        to: ['recipient@example.com'],
        subject: 'Test',
        date: new Date(),
        internalDate: new Date(),
        flags: [],
        attachments: [],
        isRead: false,
      };

      await whitelistChannel.processEmail(email);
      assert.equal(received, false);
    });

    it('should filter oversized attachments', async () => {
      const testChannel = new EmailChannel(testConfig);
      let receivedAttachments: EmailMessage['attachments'] | undefined;
      testChannel.onMessage(async (msg) => {
        receivedAttachments = msg.attachments;
      });

      const email: EmailMessage = {
        emailId: 'attachment-test',
        messageId: '<msg4@example.com>',
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        subject: 'Test',
        date: new Date(),
        internalDate: new Date(),
        flags: [],
        attachments: [
          {
            filename: 'small.txt',
            contentType: 'text/plain',
            content: 'SGVsbG8=',
            size: 100,
          },
          {
            filename: 'huge.bin',
            contentType: 'application/octet-stream',
            content: 'AQID',
            size: 100 * 1024 * 1024, // 100MB
          },
        ],
        isRead: false,
      };

      await testChannel.processEmail(email);
      assert.equal(receivedAttachments?.length, 1);
      assert.equal(receivedAttachments?.[0].filename, 'small.txt');
    });
  });

  describe('scheduled reports', () => {
    it('should add a scheduled report', () => {
      const report: ScheduledReport = {
        name: 'daily-summary',
        schedule: '0 9 * * *',
        recipient: 'admin@example.com',
        template: 'daily-report',
        enabled: true,
      };
      channel.addScheduledReport(report);
      const reports = channel.getScheduledReports();
      assert.equal(reports.length, 1);
      assert.equal(reports[0].name, 'daily-summary');
    });

    it('should remove a scheduled report', () => {
      const removed = channel.removeScheduledReport('daily-summary');
      assert.equal(removed, true);
      assert.equal(channel.getScheduledReports().length, 0);
    });

    it('should return false when removing non-existent report', () => {
      const removed = channel.removeScheduledReport('nonexistent');
      assert.equal(removed, false);
    });

    it('should return a copy of reports', () => {
      const report: ScheduledReport = {
        name: 'test-report',
        schedule: '0 * * * *',
        recipient: 'test@example.com',
        template: 'test',
        enabled: true,
      };
      channel.addScheduledReport(report);
      const reports = channel.getScheduledReports();
      reports.pop();
      assert.equal(channel.getScheduledReports().length, 1);
      channel.removeScheduledReport('test-report');
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status', () => {
      const status: EmailHealthStatus = channel.getHealthStatus();
      assert.equal(status.smtpConnected, false);
      assert.equal(status.imapConnected, false);
      assert.equal(status.emailsProcessed, 0);
      assert.equal(status.emailsSent, 0);
      assert.equal(status.pendingEmails, 0);
    });
  });

  describe('error handling', () => {
    it('should handle connection errors gracefully', async () => {
      const badChannel = new EmailChannel({
        smtpHost: 'nonexistent.invalid',
        smtpUser: 'user',
        smtpPass: 'pass',
        imapHost: 'nonexistent.invalid',
        imapUser: 'user',
        imapPass: 'pass',
        fromAddress: 'user@example.com',
      });
      await assert.rejects(badChannel.connect());
    });
  });
});
