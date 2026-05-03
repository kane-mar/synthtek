/**
 * synthtek — MCP barrel exports
 */

export * from './types.js';
export {
  MCPClientConfig,
  MCPToolInfo,
  MCPToolCallResult,
  MCPResourceReadResult,
  MCPPromptInfo,
  MCPPromptMessageContent,
  MCPPromptMessage,
  MCPPromptResult,
  JSONRPCRequest,
  JSONRPCResponse,
} from './client-types.js';
export { MCPServer } from './server.js';
export { MCPClient } from './client.js';
export { registerBuiltInTools } from './built-in-tools.js';
export { MCPTransportServer } from './transport.js';
export { MCPRunner } from './runner.js';
