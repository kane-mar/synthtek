/**
 * Tests for MCP Server stdio transport
 */

import { describe, it } from 'node:test';
import { ok, strictEqual } from 'node:assert';
import { MCPTransportServer } from '../../src/mcp/transport.js';
import { MCPServer } from '../../src/mcp/server.js';
import { AsyncFileService } from '../../src/core/filesystem.js';
import { AsyncExecutor } from '../../src/core/executor.js';
import { registerBuiltInTools } from '../../src/mcp/built-in-tools.js';

describe('MCPTransportServer', () => {
  it('handles initialize request and returns server info', async () => {
    const server = new MCPServer({ name: 'synthtek', version: '1.0.0' });
    const transport = new MCPTransportServer(server);

    const response = await transport.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
    });

    ok(response, 'response returned');
    strictEqual(response.jsonrpc, '2.0');
    strictEqual(response.id, 1);
    ok(response.result, 'result present');
    strictEqual((response.result as any).serverInfo.name, 'synthtek');
    strictEqual((response.result as any).serverInfo.version, '1.0.0');
  });

  it('handles tools/list request', async () => {
    const server = new MCPServer({ name: 'synthtek', version: '1.0.0' });
    const fs = new AsyncFileService();
    registerBuiltInTools(server, { filesystem: fs, executor: null, search: null });
    const transport = new MCPTransportServer(server);

    // Initialize first
    await transport.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
    });

    const response = await transport.handleRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    });

    ok(response, 'response returned');
    strictEqual(response.id, 2);
    const tools = (response.result as any).tools;
    ok(Array.isArray(tools), 'tools is an array');
    ok(tools.length > 0, 'at least one tool returned');
  });

  it('handles tools/call request', async () => {
    const server = new MCPServer({ name: 'synthtek', version: '1.0.0' });
    const executor = new AsyncExecutor();
    registerBuiltInTools(server, {
      filesystem: null,
      executor,
      search: null,
    });
    const transport = new MCPTransportServer(server);

    // Initialize first
    await transport.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
    });

    const response = await transport.handleRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'exec',
        arguments: { command: 'echo MCP transport works' },
      },
    });

    ok(response, 'response returned');
    strictEqual(response.id, 2);
    ok(response.result, 'result present');
    ok(
      (response.result as any).content[0].text.includes('MCP transport works'),
      'output contains command result',
    );
  });

  it('handles resources/list request', async () => {
    const server = new MCPServer({ name: 'synthtek', version: '1.0.0' });
    server.registerResource({
      uri: 'config://agent',
      name: 'Agent Config',
      description: 'Current agent configuration',
      mimeType: 'application/json',
      handler: async () => JSON.stringify({ name: 'synthtek' }),
    });
    const transport = new MCPTransportServer(server);

    // Initialize first
    await transport.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
    });

    const response = await transport.handleRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'resources/list',
      params: {},
    });

    ok(response, 'response returned');
    strictEqual(response.id, 2);
    const resources = (response.result as any).resources;
    ok(Array.isArray(resources), 'resources is an array');
    ok(resources.length > 0, 'at least one resource returned');
  });

  it('handles prompts/list request', async () => {
    const server = new MCPServer({ name: 'synthtek', version: '1.0.0' });
    server.registerPrompt({
      name: 'test_prompt',
      description: 'A test prompt',
      arguments: [],
      handler: async () => ({ messages: [] }),
    });
    const transport = new MCPTransportServer(server);

    // Initialize first
    await transport.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
    });

    const response = await transport.handleRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'prompts/list',
      params: {},
    });

    ok(response, 'response returned');
    strictEqual(response.id, 2);
    const prompts = (response.result as any).prompts;
    ok(Array.isArray(prompts), 'prompts is an array');
    ok(prompts.length > 0, 'at least one prompt returned');
  });

  it('returns error for unsupported methods', async () => {
    const server = new MCPServer({ name: 'synthtek', version: '1.0.0' });
    const transport = new MCPTransportServer(server);

    const response = await transport.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'unsupported/method',
      params: {},
    });

    ok(response, 'response returned');
    ok(response.error, 'error present for unsupported method');
    strictEqual((response.error as any).code, -32601);
  });

  it('handles initialize/initialized notification', async () => {
    const server = new MCPServer({ name: 'synthtek', version: '1.0.0' });
    const transport = new MCPTransportServer(server);

    // Initialize first
    await transport.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
    });

    // Send initialized notification (no id, no response expected)
    const response = await transport.handleRequest({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {},
    });

    strictEqual(response, undefined, 'notification returns no response');
  });
});
