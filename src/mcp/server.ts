/**
 * MCP Server implementation for synthtek
 *
 * Exposes synthtek core services as MCP tools, resources, and prompts.
 */

import type {
	MCPCapabilities,
	MCPPromptDefinition,
	MCPPromptResult,
	MCPResourceDefinition,
	MCPResourceInfo,
	MCPResourceResult,
	MCPServerConfig,
	MCPToolDefinition,
	MCPToolInput,
	MCPToolResult,
} from "./types.js";

export class MCPServer {
	readonly config: MCPServerConfig;
	private tools = new Map<string, MCPToolDefinition>();
	private resources = new Map<string, MCPResourceDefinition>();
	private prompts = new Map<string, MCPPromptDefinition>();
	private _isRunning = false;

	constructor(config: MCPServerConfig) {
		this.config = config;
	}

	get isRunning(): boolean {
		return this._isRunning;
	}

	get capabilities(): MCPCapabilities {
		return {
			tools: this.tools.size > 0,
			resources: this.resources.size > 0,
			prompts: this.prompts.size > 0,
		};
	}

	// ── Lifecycle ─────────────────────────────────────────────────────────────

	async start(): Promise<void> {
		this._isRunning = true;
	}

	async stop(): Promise<void> {
		this._isRunning = false;
	}

	// ── Tools ─────────────────────────────────────────────────────────────────

	registerTool(tool: MCPToolDefinition): void {
		this.tools.set(tool.name, tool);
	}

	async listTools(): Promise<MCPToolInput[]> {
		const result: MCPToolInput[] = [];
		for (const [, tool] of this.tools) {
			result.push({
				name: tool.name,
				description: tool.description,
				parameters: tool.parameters,
			});
		}
		return result;
	}

	async callTool(
		name: string,
		args: Record<string, unknown>,
	): Promise<MCPToolResult> {
		const tool = this.tools.get(name);
		if (!tool) {
			throw new Error(`Tool "${name}" not found`);
		}
		return tool.handler(args);
	}

	// ── Resources ─────────────────────────────────────────────────────────────

	registerResource(resource: MCPResourceDefinition): void {
		this.resources.set(resource.uri, resource);
	}

	async listResources(): Promise<MCPResourceInfo[]> {
		const result: MCPResourceInfo[] = [];
		for (const [, resource] of this.resources) {
			result.push({
				uri: resource.uri,
				name: resource.name,
				description: resource.description,
				mimeType: resource.mimeType,
			});
		}
		return result;
	}

	async readResource(uri: string): Promise<MCPResourceResult> {
		const resource = this.resources.get(uri);
		if (!resource) {
			throw new Error(`Resource "${uri}" not found`);
		}
		const content = await resource.handler();
		return { content, mimeType: resource.mimeType };
	}

	// ── Prompts ───────────────────────────────────────────────────────────────

	registerPrompt(prompt: MCPPromptDefinition): void {
		this.prompts.set(prompt.name, prompt);
	}

	async listPrompts(): Promise<
		Array<{
			name: string;
			description: string;
			arguments: Array<{
				name: string;
				description: string;
				required?: boolean;
			}>;
		}>
	> {
		const result: Array<{
			name: string;
			description: string;
			arguments: Array<{
				name: string;
				description: string;
				required?: boolean;
			}>;
		}> = [];
		for (const [, prompt] of this.prompts) {
			result.push({
				name: prompt.name,
				description: prompt.description,
				arguments: prompt.arguments,
			});
		}
		return result;
	}

	async getPrompt(
		name: string,
		args: Record<string, unknown>,
	): Promise<MCPPromptResult> {
		const prompt = this.prompts.get(name);
		if (!prompt) {
			throw new Error(`Prompt "${name}" not found`);
		}
		return prompt.handler(args);
	}
}
