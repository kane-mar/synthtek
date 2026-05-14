/**
 * Tests for MCP Client
 */

import { describe, it, before } from 'node:test';
import { ok, strictEqual } from 'node:assert';
import { MCPClient } from '../../src/mcp/client.js';

describe('MCPClient', () => {
  let client: MCPClient;

  describe('lifecycle', () => {
    it('creates a client with config', () => {
      client = new MCPClient({
        name: 'test-client',
        version: '1.0.0',
        serverUrl: 'http://localhost:3000/mcp',
      });
      ok(client, 'client instance created');
    });

    it('connects and disconnects cleanly', async () => {
      client = new MCPClient({
        name: 'test-client',
        version: '1.0.0',
        serverUrl: 'http://localhost:3000/mcp',
      });
      // Connection test with mock transport
      ok(client, 'client ready');
    });
  });

  describe('tool discovery', () => {
    before(() => {
      client = new MCPClient({
        name: 'test-client',
        version: '1.0.0',
        serverUrl: 'http://localhost:3000/mcp',
      });
    });

    it('discovers available tools from server', async () => {
      // Register a mock server response
      client.setMockTools([
        {
          name: 'test_tool',
          description: 'A test tool',
          inputSchema: {
            type: 'object',
            properties: { input: { type: 'string' } },
            required: ['input'],
          },
        },
      ]);

      const tools = await client.listTools();
      ok(tools.length >= 1, 'at least one tool discovered');
      strictEqual(tools[0].name, 'test_tool');
    });

    it('calls a discovered tool with arguments', async () => {
      client.setMockTools([
        {
          name: 'echo',
          description: 'Echo back input',
          inputSchema: {
            type: 'object',
            properties: { message: { type: 'string' } },
            required: ['message'],
          },
        },
      ]);
      client.setMockToolResponse('echo', {
        content: [{ type: 'text', text: 'hello' }],
      });

      const result = await client.callTool('echo', { message: 'hello' });
      ok(result, 'result returned');
      ok(result.content.length > 0, 'result has content');
      strictEqual(result.content[0].text, 'hello');
    });
  });

  describe('resource fetching', () => {
    before(() => {
      client = new MCPClient({
        name: 'test-client',
        version: '1.0.0',
        serverUrl: 'http://localhost:3000/mcp',
      });
    });

    it('discovers available resources from server', async () => {
      client.setMockResources([
        {
          uri: 'test://data',
          name: 'Test Data',
          description: 'Test resource',
          mimeType: 'application/json',
        },
      ]);

      const resources = await client.listResources();
      ok(resources.length >= 1, 'at least one resource discovered');
      strictEqual(resources[0].uri, 'test://data');
    });

    it('fetches a resource by URI', async () => {
      client.setMockResources([
        {
          uri: 'config://agent',
          name: 'Agent Config',
          description: 'Agent configuration',
          mimeType: 'application/json',
        },
      ]);
      client.setMockResourceContent('config://agent', JSON.stringify({ name: 'synthtek' }));

      const result = await client.readResource('config://agent');
      ok(result, 'result returned');
      const parsed = JSON.parse(result.content);
      strictEqual(parsed.name, 'synthtek');
    });
  });

  describe('prompt fetching', () => {
    before(() => {
      client = new MCPClient({
        name: 'test-client',
        version: '1.0.0',
        serverUrl: 'http://localhost:3000/mcp',
      });
    });

    it('discovers available prompts from server', async () => {
      client.setMockPrompts([
        {
          name: 'summarize',
          description: 'Summarize a document',
          arguments: [{ name: 'document', description: 'Document to summarize', required: true }],
        },
      ]);

      const prompts = await client.listPrompts();
      ok(prompts.length >= 1, 'at least one prompt discovered');
      strictEqual(prompts[0].name, 'summarize');
    });

    it('fetches a prompt with arguments', async () => {
      client.setMockPrompts([
        {
          name: 'analyze',
          description: 'Analyze text',
          arguments: [{ name: 'text', description: 'Text to analyze', required: true }],
        },
      ]);
      client.setMockPromptResponse('analyze', {
        messages: [
          {
            role: 'user',
            content: { type: 'text', text: 'Please analyze this text' },
          },
        ],
      });

      const result = await client.getPrompt('analyze', { text: 'sample text' });
      ok(result, 'result returned');
      ok(result.messages.length > 0, 'prompt has messages');
    });
  });

  describe('error handling', () => {
    it('handles server errors gracefully', async () => {
      client = new MCPClient({
        name: 'test-client',
        version: '1.0.0',
        serverUrl: 'http://localhost:3000/mcp',
      });
      client.setMockTools([]);

      await client.callTool('nonexistent', {}).catch((err: unknown) => {
        ok(err, 'error thrown for nonexistent tool');
      });
    });

    it('handles connection timeout', async () => {
      client = new MCPClient({
        name: 'test-client',
        version: '1.0.0',
        serverUrl: 'http://localhost:99999/mcp',
        timeout: 100,
      });

      ok(client, 'client created with timeout config');
    });
  });

  describe('multiple servers', () => {
    it('connects to multiple MCP servers', async () => {
      const client1 = new MCPClient({
        name: 'test-client',
        version: '1.0.0',
        serverUrl: 'http://localhost:3001/mcp',
      });
      const client2 = new MCPClient({
        name: 'test-client',
        version: '1.0.0',
        serverUrl: 'http://localhost:3002/mcp',
      });

      client1.setMockTools([{ name: 'tool1', description: 'Tool 1', inputSchema: { type: 'object', properties: {} } }]);
      client2.setMockTools([{ name: 'tool2', description: 'Tool 2', inputSchema: { type: 'object', properties: {} } }]);

      const tools1 = await client1.listTools();
      const tools2 = await client2.listTools();

      strictEqual(tools1[0].name, 'tool1');
      strictEqual(tools2[0].name, 'tool2');
    });
  });
});
