/**
 * Tool Registry
 * Manages registration, discovery, and execution of agent tools.
 */

import type { ToolCall, ToolResult } from "./types.js";

export interface ToolDefinition {
	/** Unique tool name */
	name: string;
	/** Human-readable description */
	description: string;
	/** JSON Schema for the tool's parameters */
	parameters: Record<string, unknown>;
	/** Whether the tool is enabled */
	enabled?: boolean;
}

export type ToolHandler = (
	args: Record<string, unknown>,
) => Promise<ToolResult>;

export class ToolRegistry {
	private tools: Map<string, ToolDefinition> = new Map();
	private handlers: Map<string, ToolHandler> = new Map();

	/** Register a tool with its handler */
	register(tool: ToolDefinition, handler: ToolHandler): void {
		if (this.tools.has(tool.name)) {
			throw new Error(`Tool "${tool.name}" is already registered`);
		}
		this.tools.set(tool.name, tool);
		this.handlers.set(tool.name, handler);
	}

	/** Unregister a tool */
	unregister(name: string): void {
		this.tools.delete(name);
		this.handlers.delete(name);
	}

	/** Get all registered tool definitions */
	getTools(): ToolDefinition[] {
		return Array.from(this.tools.values()).filter((t) => t.enabled !== false);
	}

	/** Check if a tool is registered */
	hasTool(name: string): boolean {
		return this.tools.has(name);
	}

	/** Execute a tool call and return the result */
	async execute(call: ToolCall): Promise<ToolResult> {
		const handler = this.handlers.get(call.name);
		if (!handler) {
			return {
				callId: call.id,
				name: call.name,
				content: "",
				error: `Unknown tool: ${call.name}`,
			};
		}

		const tool = this.tools.get(call.name);
		if (tool?.enabled === false) {
			return {
				callId: call.id,
				name: call.name,
				content: "",
				error: `Tool "${call.name}" is disabled`,
			};
		}

		try {
			const result = await handler(call.arguments);
			return {
				callId: call.id,
				name: call.name,
				content: result.content,
				error: result.error,
			};
		} catch (error) {
			return {
				callId: call.id,
				name: call.name,
				content: "",
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/** Execute multiple tool calls in sequence */
	async executeAll(calls: ToolCall[]): Promise<ToolResult[]> {
		return Promise.all(calls.map((call) => this.execute(call)));
	}

	/** Get the number of registered tools */
	getToolCount(): number {
		return this.tools.size;
	}
}
