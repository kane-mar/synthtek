/**
 * synthtek — MCP barrel exports
 */

export { registerBuiltInTools } from "./built-in-tools.js";
export { MCPClient } from "./client.js";
export type {
	JSONRPCRequest,
	JSONRPCResponse,
	MCPClientConfig,
	MCPPromptInfo,
	MCPPromptMessage,
	MCPPromptMessageContent,
	MCPPromptResult,
	MCPResourceReadResult,
	MCPToolCallResult,
	MCPToolInfo,
} from "./client-types.js";
export { MCPRunner } from "./runner.js";
export { MCPServer } from "./server.js";
export { MCPTransportServer } from "./transport.js";
export * from "./types.js";
