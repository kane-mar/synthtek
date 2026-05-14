/**
 * Feishu/Lark Channel — Lark API integration for synthtek
 */

import https from 'node:https';
import http from 'node:http';
import { BaseChannel } from '../base-channel.js';
import type {
  FeishuConfig,
  FeishuMessage,
  FeishuSendOptions,
  FeishuCardOptions,
  FeishuCardResult,
  FeishuUserInfo,
  FeishuChatInfo,
  FeishuHealthStatus,
} from './types.js';

const DEFAULT_API_BASE_CN = 'https://open.feishu.cn';
const DEFAULT_API_BASE_GLOBAL = 'https://open.larksuite.com';
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;

export class FeishuChannel extends BaseChannel<FeishuConfig, FeishuMessage> {
  private accessToken: string | undefined;
  private tokenExpiry: number | undefined;
  private webhookServer: ReturnType<typeof http.createServer> | null = null;

  constructor(config: FeishuConfig) {
    super({
      useGlobalDomain: false,
      maxRetries: DEFAULT_MAX_RETRIES,
      retryDelay: DEFAULT_RETRY_DELAY,
      webhookPort: 8080,
      cardKitEnabled: false,
      ...config,
    });
  }

  async connect(): Promise<void> {
    try {
      await this.authenticate();
      this.markConnected();
    } catch (err) {
      throw new Error(
        `Feishu connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  async disconnect(): Promise<void> {
    this.markDisconnected();
    this.accessToken = undefined;
    if (this.webhookServer) {
      this.webhookServer.close();
      this.webhookServer = null;
    }
  }

  private getApiBase(): string {
    return this.getConfig().useGlobalDomain ? DEFAULT_API_BASE_GLOBAL : DEFAULT_API_BASE_CN;
  }

  private async authenticate(): Promise<void> {
    const config = this.getConfig();
    const response = await this.requestRaw(
      'POST',
      '/open-apis/auth/v3/tenant_access_token/internal',
      {
        app_id: config.appId,
        app_secret: config.appSecret,
      },
    );

    const data = response as Record<string, unknown>;
    if ((data.code as number) !== 0) {
      throw new Error(`Auth failed: ${(data.msg as string) ?? 'Unknown error'}`);
    }

    this.accessToken = data.tenant_access_token as string;
    this.tokenExpiry = Date.now() + ((data.expire as number) ?? 7200) * 1000;
  }

  async sendMessage(options: FeishuSendOptions): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Feishu channel is not connected');
    }

    if (this.tokenExpiry && Date.now() >= this.tokenExpiry) {
      await this.authenticate();
    }

    const body: Record<string, unknown> = {
      receive_id: options.receiveId,
      receive_id_type: options.receiveIdType ?? 'chat_id',
      msg_type: options.msgType,
      content: JSON.stringify({ text: options.content }),
    };

    if (options.uuid) {
      body.uuid = options.uuid;
    }

    const path = options.replyMessageId
      ? `/open-apis/im/v1/messages/${encodeURIComponent(options.replyMessageId)}/reply`
      : '/open-apis/im/v1/messages';

    const response = await this.request('POST', path, body);
    const data = response as Record<string, unknown>;

    if ((data.code as number) !== 0) {
      throw new Error(`Send failed: ${(data.msg as string) ?? 'Unknown error'}`);
    }

    this.recordSent();

    return ((data.data as Record<string, unknown>)?.message_id as string) ?? '';
  }

  async sendCard(options: FeishuCardOptions): Promise<FeishuCardResult> {
    if (!this.isConnected()) {
      return { success: false, error: 'Feishu channel is not connected' };
    }

    try {
      const body: Record<string, unknown> = {
        receive_id: options.receiveId,
        receive_id_type: options.receiveIdType ?? 'chat_id',
        msg_type: 'interactive',
        content: JSON.stringify(options.card),
      };

      if (options.messageId) {
        await this.request(
          'PUT',
          `/open-apis/im/v1/messages/${encodeURIComponent(options.messageId)}`,
          body,
        );
        return { success: true, messageId: options.messageId };
      }

      const response = await this.request('POST', '/open-apis/im/v1/messages', body);
      const data = response as Record<string, unknown>;

      if ((data.code as number) !== 0) {
        return { success: false, error: (data.msg as string) ?? 'Unknown error' };
      }

      this.recordSent();

      return {
        success: true,
        messageId: ((data.data as Record<string, unknown>)?.message_id as string) ?? undefined,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  async getUserInfo(userId: string): Promise<FeishuUserInfo> {
    if (!this.isConnected()) {
      throw new Error('Feishu channel is not connected');
    }

    const response = await this.request(
      'GET',
      `/open-apis/contact/v3/users/${encodeURIComponent(userId)}`,
    );
    const data = response as Record<string, unknown>;
    const user = ((data.data as Record<string, unknown>)?.user as Record<string, unknown>) ?? {};

    return {
      userId: (user.user_id as string) ?? userId,
      openId: (user.open_id as string) ?? '',
      name: (user.name as string) ?? '',
      email: (user.email as string) ?? undefined,
      avatarUrl: ((user.avatar as Record<string, unknown>)?.avatar_72 as string) ?? undefined,
      title: (user.title as string) ?? undefined,
    };
  }

  async getChatInfo(chatId: string): Promise<FeishuChatInfo> {
    if (!this.isConnected()) {
      throw new Error('Feishu channel is not connected');
    }

    const response = await this.request(
      'GET',
      `/open-apis/im/v1/chats/${encodeURIComponent(chatId)}`,
    );
    const data = response as Record<string, unknown>;
    const chat = ((data.data as Record<string, unknown>)?.chat as Record<string, unknown>) ?? {};

    return {
      chatId,
      name: (chat.name as string) ?? undefined,
      chatType: (chat.chat_type as FeishuChatInfo['chatType']) ?? 'p2p',
      ownerId: (chat.owner_id as string) ?? undefined,
      createTime: (chat.create_time as number) ?? undefined,
    };
  }

  async startWebhook(): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Feishu channel is not connected');
    }

    this.webhookServer = http.createServer((req, res) => {
      this.handleWebhook(req, res);
    });

    this.webhookServer.listen(this.getConfig().webhookPort ?? 8080);
  }

  private handleWebhook(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          const data = JSON.parse(body) as Record<string, unknown>;
          const header = data.header as Record<string, unknown> | undefined;
          const event = data.event as Record<string, unknown> | undefined;

          if (header?.event_type === 'im.message.receive_v1' && event) {
            const message = (event.message as Record<string, unknown>) ?? {};
            const content = JSON.parse(
              (message.content as string) ?? '{}',
            ) as Record<string, unknown>;

            const msg: FeishuMessage = {
              messageId: (message.message_id as string) ?? '',
              chatId: (message.chat_id as string) ?? '',
              chatType: (message.chat_type as FeishuMessage['chatType']) ?? 'p2p',
              senderId: ((message.sender as Record<string, unknown>)?.sender_id as string) ?? '',
              senderName: undefined,
              content: (content.text as string) ?? '',
              messageType: (message.message_type as FeishuMessage['messageType']) ?? 'text',
              timestamp: Date.now(),
              createTime: (message.create_time as number) ?? Date.now(),
              mentions: content.mentions as FeishuMessage['mentions'],
              parentId: (message.parent_id as string) ?? undefined,
              rootId: (message.root_id as string) ?? undefined,
            };

            this.recordReceived();
            await this.dispatchMessage(msg);
          }

          res.writeHead(200);
          res.end(JSON.stringify({ code: 0 }));
        } catch {
          res.writeHead(400);
          res.end(JSON.stringify({ code: 400 }));
        }
      });
    } else {
      res.writeHead(405);
      res.end('Method Not Allowed');
    }
  }

  getHealthStatus(): FeishuHealthStatus {
    const stats = this.getStats();
    return {
      connected: stats.connected,
      tokenValid:
        this.accessToken !== undefined && (!this.tokenExpiry || Date.now() < this.tokenExpiry),
      tokenExpiry: this.tokenExpiry,
      messagesSent: stats.messagesSent,
      messagesReceived: stats.messagesReceived,
      lastActivity: stats.lastActivity,
    };
  }

  private async request(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<unknown> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    return this.requestRaw(method, path, body, headers);
  }

  private async requestRaw(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    extraHeaders?: Record<string, string>,
  ): Promise<unknown> {
    const baseUrl = this.getApiBase();
    const url = new URL(path, baseUrl);

    const headers = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };

    const bodyStr = body ? JSON.stringify(body) : undefined;

    return new Promise((resolve, reject) => {
      const req = https.request(url, { method, headers }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        });
      });

      req.on('error', reject);
      if (bodyStr) req.write(bodyStr);
      req.end();
    });
  }
}
