/**
 * MCP Server type definitions for synthtek
 */

// ── MCP Tool ────────────────────────────────────────────────────────────────

export interface MCPToolParameterSchema {
	type: "object";
	properties: Record<string, unknown>;
	required?: string[];
}

export interface MCPToolInput {
	name: string;
	description: string;
	parameters: MCPToolParameterSchema;
}

export interface MCPToolResultContent {
	type: "text" | "image" | "audio";
	text?: string;
	data?: string;
	mimeType?: string;
}

export interface MCPToolResult {
	content: MCPToolResultContent[];
	isError?: boolean;
}

export type MCPToolHandler = (
	args: Record<string, unknown>,
) => Promise<MCPToolResult>;

export interface MCPToolDefinition extends MCPToolInput {
	handler: MCPToolHandler;
}

// ── MCP Resource ────────────────────────────────────────────────────────────

export interface MCPResourceInfo {
	uri: string;
	name: string;
	description: string;
	mimeType: string;
}

export interface MCPResourceResult {
	content: string;
	mimeType?: string;
}

export type MCPResourceHandler = () => Promise<string>;

export interface MCPResourceDefinition extends MCPResourceInfo {
	handler: MCPResourceHandler;
}

// ── MCP Prompt ──────────────────────────────────────────────────────────────

export interface MCPPromptArgument {
	name: string;
	description: string;
	required?: boolean;
}

export interface MCPPromptMessageContent {
	type: "text" | "image";
	text?: string;
	data?: string;
	mimeType?: string;
}

export interface MCPPromptMessage {
	role: "user" | "assistant";
	content: MCPPromptMessageContent;
}

export interface MCPPromptResult {
	messages: MCPPromptMessage[];
	description?: string;
}

export type MCPPromptHandler = (
	args: Record<string, unknown>,
) => Promise<MCPPromptResult>;

export interface MCPPromptDefinition {
	name: string;
	description: string;
	arguments: MCPPromptArgument[];
	handler: MCPPromptHandler;
}

// ── MCP Server Config ───────────────────────────────────────────────────────

export interface MCPServerConfig {
	name: string;
	version: string;
	workspace?: string;
}

// ── MCP Capabilities ────────────────────────────────────────────────────────

export interface MCPCapabilities {
	tools?: boolean;
	resources?: boolean;
	prompts?: boolean;
}
