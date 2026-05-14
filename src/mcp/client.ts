/**
 * MCP Client — connects to external MCP servers to discover and use tools,
 * fetch resources, and retrieve prompts.
 */

import {
  MCPClientConfig,
  MCPToolInfo,
  MCPToolCallResult,
  MCPResourceInfo,
  MCPResourceReadResult,
  MCPPromptInfo,
  MCPPromptResult,
  JSONRPCRequest,
  JSONRPCResponse,
} from './client-types.js';

export class MCPClient {
  private config: MCPClientConfig;
  private connected: boolean = false;
  private requestId: number = 0;

  // Mock data for testing
  private mockTools: MCPToolInfo[] = [];
  private mockResources: MCPResourceInfo[] = [];
  private mockPrompts: MCPPromptInfo[] = [];
  private mockToolResponses: Map<string, MCPToolCallResult> = new Map();
  private mockResourceContents: Map<string, string> = new Map();
  private mockPromptResponses: Map<string, MCPPromptResult> = new Map();

  constructor(config: MCPClientConfig) {
    this.config = config;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (this.connected) return;

    const timeout = this.config.timeout ?? 10000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(this.config.serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        body: JSON.stringify(this.buildRequest('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: true },
            resources: { subscribe: true, listChanged: true },
            prompts: { listChanged: true },
          },
          clientInfo: {
            name: this.config.name,
            version: this.config.version,
          },
        })),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`MCP server returned ${response.status}`);
      }

      this.connected = true;
    } catch (err: unknown) {
      if (this.mockTools.length > 0 || this.mockResources.length > 0) {
        // In mock mode, connection is fine
        this.connected = true;
      } else {
        throw err;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    this.connected = false;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  // ── Tool Discovery & Execution ────────────────────────────────────────────

  async listTools(): Promise<MCPToolInfo[]> {
    if (this.mockTools.length > 0) {
      return [...this.mockTools];
    }

    await this.connect();
    const response = await this.sendRequest('tools/list', {});
    const result = response.result as { tools: MCPToolInfo[] };
    return result?.tools ?? [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolCallResult> {
    if (this.mockToolResponses.has(name)) {
      return this.mockToolResponses.get(name)!;
    }

    if (this.mockTools.length > 0) {
      const tool = this.mockTools.find((t) => t.name === name);
      if (!tool) {
        throw new Error(`Tool '${name}' not found`);
      }
    }

    await this.connect();
    const response = await this.sendRequest('tools/call', { name, arguments: args });
    return response.result as MCPToolCallResult;
  }

  // ── Resource Discovery & Fetching ─────────────────────────────────────────

  async listResources(): Promise<MCPResourceInfo[]> {
    if (this.mockResources.length > 0) {
      return [...this.mockResources];
    }

    await this.connect();
    const response = await this.sendRequest('resources/list', {});
    const result = response.result as { resources: MCPResourceInfo[] };
    return result?.resources ?? [];
  }

  async readResource(uri: string): Promise<MCPResourceReadResult> {
    if (this.mockResourceContents.has(uri)) {
      const resource = this.mockResources.find((r) => r.uri === uri);
      return {
        content: this.mockResourceContents.get(uri)!,
        mimeType: resource?.mimeType,
      };
    }

    await this.connect();
    const response = await this.sendRequest('resources/read', { uri });
    return response.result as MCPResourceReadResult;
  }

  // ── Prompt Discovery & Fetching ───────────────────────────────────────────

  async listPrompts(): Promise<MCPPromptInfo[]> {
    if (this.mockPrompts.length > 0) {
      return [...this.mockPrompts];
    }

    await this.connect();
    const response = await this.sendRequest('prompts/list', {});
    const result = response.result as { prompts: MCPPromptInfo[] };
    return result?.prompts ?? [];
  }

  async getPrompt(name: string, args: Record<string, string> = {}): Promise<MCPPromptResult> {
    if (this.mockPromptResponses.has(name)) {
      return this.mockPromptResponses.get(name)!;
    }

    await this.connect();
    const response = await this.sendRequest('prompts/get', { name, arguments: args });
    return response.result as MCPPromptResult;
  }

  // ── Mock Helpers (for testing) ────────────────────────────────────────────

  setMockTools(tools: MCPToolInfo[]): void {
    this.mockTools = [...tools];
  }

  setMockResources(resources: MCPResourceInfo[]): void {
    this.mockResources = [...resources];
  }

  setMockPrompts(prompts: MCPPromptInfo[]): void {
    this.mockPrompts = [...prompts];
  }

  setMockToolResponse(name: string, response: MCPToolCallResult): void {
    this.mockToolResponses.set(name, response);
  }

  setMockResourceContent(uri: string, content: string): void {
    this.mockResourceContents.set(uri, content);
  }

  setMockPromptResponse(name: string, response: MCPPromptResult): void {
    this.mockPromptResponses.set(name, response);
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private buildRequest(method: string, params: Record<string, unknown>): JSONRPCRequest {
    return {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
      params,
    };
  }

  private async sendRequest(method: string, params: Record<string, unknown>): Promise<JSONRPCResponse> {
    const request = this.buildRequest(method, params);
    const response = await fetch(this.config.serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`MCP server returned ${response.status}`);
    }

    return response.json() as Promise<JSONRPCResponse>;
  }
}
