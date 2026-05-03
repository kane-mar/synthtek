/**
 * MCP Client type definitions for synthtek
 * Re-exports shared types from types.ts and adds client-specific types.
 */

export type { MCPResourceInfo } from './types.js';

// ── MCP Client Config ───────────────────────────────────────────────────────

export interface MCPClientConfig {
  name: string;
  version: string;
  serverUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
}

// ── MCP Tool Types ──────────────────────────────────────────────────────────

export interface MCPToolInfo {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPToolCallResult {
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
}

// ── MCP Resource Types ──────────────────────────────────────────────────────

export interface MCPResourceReadResult {
  content: string;
  mimeType?: string;
}

// ── MCP Prompt Types ────────────────────────────────────────────────────────

export interface MCPPromptInfo {
  name: string;
  description: string;
  arguments: Array<{ name: string; description: string; required?: boolean }>;
}

export interface MCPPromptMessageContent {
  type: 'text' | 'image';
  text?: string;
  data?: string;
  mimeType?: string;
}

export interface MCPPromptMessage {
  role: 'user' | 'assistant';
  content: MCPPromptMessageContent;
}

export interface MCPPromptResult {
  messages: MCPPromptMessage[];
  description?: string;
}

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
