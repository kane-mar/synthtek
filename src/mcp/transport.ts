/**
 * MCP stdio transport layer
 *
 * Handles JSON-RPC 2.0 requests for MCP protocol methods.
 */

import { MCPServer } from './server.js';

// ── JSON-RPC Types ──────────────────────────────────────────────────────────

export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id?: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id?: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

// ── Transport Server ────────────────────────────────────────────────────────

export class MCPTransportServer {
  private server: MCPServer;
  private initialized = false;

  constructor(server: MCPServer) {
    this.server = server;
  }

  async handleRequest(
    message: JSONRPCRequest | JSONRPCNotification,
  ): Promise<JSONRPCResponse | undefined> {
    // Notifications have no id → no response
    const hasId = 'id' in message;
    if (!hasId) {
      await this.handleNotification(message as JSONRPCNotification);
      return undefined;
    }

    const request = message as JSONRPCRequest;

    try {
      const result = await this.dispatch(request.method, request.params ?? {});
      return { jsonrpc: '2.0', id: request.id, result };
    } catch (err) {
      const error = err as Error & { __code?: number };
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: error.__code ?? -32603,
          message: error.message,
        },
      };
    }
  }

  private async dispatch(
    method: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    switch (method) {
      case 'initialize':
        return this.handleInitialize(params);
      case 'initialization':
        // Some clients use "initialization" instead of "initialize"
        return this.handleInitialize(params);
      case 'tools/list':
        return this.handleToolsList();
      case 'tools/call':
        return this.handleToolCall(params);
      case 'resources/list':
        return this.handleResourcesList();
      case 'resources/read':
        return this.handleResourceRead(params);
      case 'prompts/list':
        return this.handlePromptsList();
      case 'prompts/get':
        return this.handlePromptGet(params);
      case 'ping':
        return {};
      default:
        // Return method-not-found error with proper JSON-RPC code
        const notFoundError = new Error(`Method not found: ${method}`);
        (notFoundError as unknown as Error & { __code?: number }).__code = -32601;
        throw notFoundError;
    }
  }

  private async handleNotification(_notification: JSONRPCNotification): Promise<void> {
    // Handle notifications (no response expected)
    // notifications/initialized, notifications/cancelled, etc.
  }

  // ── Initialize ────────────────────────────────────────────────────────────

  private async handleInitialize(
    _params: Record<string, unknown>,
  ): Promise<unknown> {
    this.initialized = true;

    return {
      protocolVersion: '2024-11-05',
      capabilities: this.buildCapabilities(),
      serverInfo: {
        name: this.server.config.name,
        version: this.server.config.version,
      },
    };
  }

  private buildCapabilities(): Record<string, unknown> {
    const caps: Record<string, unknown> = {};
    const serverCaps = this.server.capabilities;

    if (serverCaps.tools) {
      caps.tools = {};
    }
    if (serverCaps.resources) {
      caps.resources = {};
    }
    if (serverCaps.prompts) {
      caps.prompts = {};
    }

    return caps;
  }

  // ── Tools ─────────────────────────────────────────────────────────────────

  private async handleToolsList(): Promise<unknown> {
    if (!this.initialized) {
      throw new Error('Server not initialized');
    }

    const tools = await this.server.listTools();
    return {
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.parameters,
      })),
    };
  }

  private async handleToolCall(params: Record<string, unknown>): Promise<unknown> {
    if (!this.initialized) {
      throw new Error('Server not initialized');
    }

    const name = params.name as string;
    const arguments_ = params.arguments as Record<string, unknown> | undefined;

    if (!name) {
      throw new Error('Tool name is required');
    }

    const result = await this.server.callTool(name, arguments_ ?? {});
    return {
      content: result.content,
      isError: result.isError,
    };
  }

  // ── Resources ─────────────────────────────────────────────────────────────

  private async handleResourcesList(): Promise<unknown> {
    if (!this.initialized) {
      throw new Error('Server not initialized');
    }

    const resources = await this.server.listResources();
    return {
      resources: resources.map((r) => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mimeType: r.mimeType,
      })),
    };
  }

  private async handleResourceRead(params: Record<string, unknown>): Promise<unknown> {
    if (!this.initialized) {
      throw new Error('Server not initialized');
    }

    const uri = params.uri as string;
    if (!uri) {
      throw new Error('Resource URI is required');
    }

    const result = await this.server.readResource(uri);
    return {
      contents: [
        {
          uri,
          mimeType: result.mimeType,
          text: result.content,
        },
      ],
    };
  }

  // ── Prompts ───────────────────────────────────────────────────────────────

  private async handlePromptsList(): Promise<unknown> {
    if (!this.initialized) {
      throw new Error('Server not initialized');
    }

    const prompts = await this.server.listPrompts();
    return {
      prompts: prompts.map((p) => ({
        name: p.name,
        description: p.description,
        arguments: p.arguments,
      })),
    };
  }

  private async handlePromptGet(params: Record<string, unknown>): Promise<unknown> {
    if (!this.initialized) {
      throw new Error('Server not initialized');
    }

    const name = params.name as string;
    const arguments_ = params.arguments as Record<string, unknown> | undefined;

    if (!name) {
      throw new Error('Prompt name is required');
    }

    const result = await this.server.getPrompt(name, arguments_ ?? {});
    return {
      messages: result.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };
  }
}
