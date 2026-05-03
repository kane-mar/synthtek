/**
 * WhatsApp Channel — WhatsApp Business API integration for synthtek
 */

import https from 'node:https';
import http from 'node:http';
import crypto from 'node:crypto';
import { BaseChannel } from '../base-channel.js';
import type {
  WhatsAppConfig,
  WhatsAppMessage,
  WhatsAppSendOptions,
  WhatsAppSendResult,
  WhatsAppHealthStatus,
} from './types.js';

const DEFAULT_API_BASE = 'https://graph.facebook.com';
const DEFAULT_API_VERSION = 'v18.0';
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;

export class WhatsAppChannel extends BaseChannel<WhatsAppConfig, WhatsAppMessage> {
  private webhookServer: ReturnType<typeof http.createServer> | null = null;
  private processedIds = new Set<string>();

  constructor(config: WhatsAppConfig) {
    super({
      apiBaseUrl: DEFAULT_API_BASE,
      apiVersion: DEFAULT_API_VERSION,
      webhookEnabled: false,
      webhookPort: 5678,
      maxRetries: DEFAULT_MAX_RETRIES,
      retryDelay: DEFAULT_RETRY_DELAY,
      readReceipts: false,
      typingEnabled: true,
      ...config,
    });
  }

  async connect(): Promise<void> {
    try {
      await this.verifyPhoneNumber();
      this.markConnected();
    } catch (err) {
      throw new Error(
        `WhatsApp connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  async disconnect(): Promise<void> {
    this.markDisconnected();
    if (this.webhookServer) {
      this.webhookServer.close();
      this.webhookServer = null;
    }
  }

  private async verifyPhoneNumber(): Promise<void> {
    const config = this.getConfig();
    await this.request('GET', `/${config.apiVersion}/${config.phoneNumberId}`);
  }

  async sendMessage(options: WhatsAppSendOptions): Promise<WhatsAppSendResult> {
    if (!this.isConnected()) {
      return { success: false, error: 'WhatsApp channel is not connected' };
    }

    try {
      const config = this.getConfig();
      const body: Record<string, unknown> = {
        messaging_product: 'whatsapp',
        to: options.to,
        type: options.type,
      };

      if (options.type === 'text') {
        body.text = {
          body: options.text ?? '',
          preview_url: options.previewUrl ?? false,
        };
      } else if (options.type === 'template') {
        body.template = {
          name: options.templateName,
          components: options.templateComponents,
        };
      } else if (['image', 'audio', 'video', 'document'].includes(options.type)) {
        body[options.type] = {
          id: options.mediaId,
          caption: options.caption,
        };
      }

      if (options.replyTo) {
        body.context = { message_id: options.replyTo };
      }

      const response = await this.request(
        'POST',
        `/${config.apiVersion}/${config.phoneNumberId}/messages`,
        body,
      );

      this.recordSent();

      const data = response as Record<string, unknown>;
      const messages = (data.messages as Array<Record<string, unknown>>) ?? [];
      const message = messages[0] ?? {};

      return {
        success: true,
        messageId: (message.id as string) ?? undefined,
        pricing: data.pricing as WhatsAppSendResult['pricing'],
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  async startWebhook(): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('WhatsApp channel is not connected');
    }

    this.webhookServer = http.createServer((req, res) => {
      this.handleWebhook(req, res);
    });

    this.webhookServer.listen(this.getConfig().webhookPort ?? 5678);
  }

  private handleWebhook(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (req.method === 'GET') {
      const url = new URL(req.url ?? '', `http://${req.headers.host}`);
      if (url.searchParams.has('hub.verify_token')) {
        const token = url.searchParams.get('hub.verify_token');
        const challenge = url.searchParams.get('hub.challenge');
        if (token === this.getConfig().webhookVerifyToken) {
          res.writeHead(200);
          res.end(challenge ?? '');
          return;
        }
      }
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end('Method Not Allowed');
      return;
    }

    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const config = this.getConfig();
        const signature = req.headers['x-hub-signature-256'] as string;
        if (config.webhookAppSecret && signature) {
          const expected = crypto
            .createHmac('sha256', config.webhookAppSecret)
            .update(body)
            .digest('hex');
          if (`sha256=${expected}` !== signature) {
            res.writeHead(401);
            res.end('Unauthorized');
            return;
          }
        }

        const data = JSON.parse(body) as Record<string, unknown>;
        const entries = (data.entry as Array<Record<string, unknown>>) ?? [];
        const entry = entries[0] ?? {};
        const changes = ((entry.changes as Array<Record<string, unknown>>) ?? [])[0] ?? {};
        const value = changes.value as Record<string, unknown> | undefined;
        if (!value) {
          res.writeHead(200);
          res.end('OK');
          return;
        }

        const messages = (value.messages as Array<Record<string, unknown>>) ?? [];
        for (const msg of messages) {
          const msgId = (msg.id as string) ?? '';
          if (this.processedIds.has(msgId)) continue;
          this.processedIds.add(msgId);

          const whatsappMsg: WhatsAppMessage = {
            messageId: msgId,
            from: msg.from as string,
            fromName: undefined,
            to: ((value.metadata as Record<string, unknown>)?.display_phone_number as string) ??
              '',
            timestamp: Date.now(),
            type: (msg.type as WhatsAppMessage['type']) ?? 'text',
            text:
              msg.type === 'text'
                ? { body: ((msg.text as Record<string, unknown>)?.body as string) ?? '' }
                : undefined,
            media:
              msg.type !== 'text'
                ? {
                    id: ((msg[msg.type as keyof typeof msg] as Record<string, unknown>)?.id as string) ??
                      '',
                    mimetype:
                      ((msg[msg.type as keyof typeof msg] as Record<string, unknown>)?.mimetype as string) ??
                      '',
                  }
                : undefined,
            reaction:
              msg.type === 'reaction'
                ? {
                    message_id:
                      ((msg.reaction as Record<string, unknown>)?.message_id as string) ?? '',
                    emoji: ((msg.reaction as Record<string, unknown>)?.emoji as string) ?? '',
                  }
                : undefined,
            context: msg.context
              ? {
                  message_id: ((msg.context as Record<string, unknown>)?.id as string) ?? '',
                  from: ((msg.context as Record<string, unknown>)?.from as string) ?? '',
                  forwarded: ((msg.context as Record<string, unknown>)?.forwarded as boolean) ?? false,
                }
              : undefined,
            metadata: value.metadata as WhatsAppMessage['metadata'],
          };

          this.recordReceived();
          await this.dispatchMessage(whatsappMsg);
        }

        res.writeHead(200);
        res.end('OK');
      } catch {
        res.writeHead(400);
        res.end('Bad Request');
      }
    });
  }

  getHealthStatus(): WhatsAppHealthStatus {
    const stats = this.getStats();
    return {
      connected: stats.connected,
      phoneNumberStatus: stats.connected ? 'connected' : 'disconnected',
      messagesSent: stats.messagesSent,
      messagesReceived: stats.messagesReceived,
      lastActivity: stats.lastActivity,
      webhookActive: this.webhookServer !== null,
    };
  }

  private async request(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<unknown> {
    const config = this.getConfig();
    const baseUrl = config.apiBaseUrl ?? DEFAULT_API_BASE;
    const url = new URL(path, baseUrl);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    };

    const bodyStr = body ? JSON.stringify(body) : undefined;

    return new Promise((resolve, reject) => {
      const req = https.request(url, { method, headers }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(data ? JSON.parse(data) : {});
            } catch {
              resolve(data);
            }
          } else {
            reject(new Error(`WhatsApp API error: ${res.statusCode} ${data}`));
          }
        });
      });

      req.on('error', reject);
      if (bodyStr) req.write(bodyStr);
      req.end();
    });
  }
}
