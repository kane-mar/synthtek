/**
 * Skill Injector
 *
 * Adapter layer that injects external skills (LangChain tools, AutoGPT plugins,
 * custom executors) into the agent's ToolRegistry.
 *
 * Usage:
 *   const injector = new SkillInjector(registry);
 *   injector.injectLangChain(myToolDef, myHandler);
 *   injector.injectExecutor("my-skill", { command: "node script.js", cwd: "/path" });
 *   injector.injectHttp("my-api", { url: "https://api.example.com/action", method: "POST" });
 */

import { execSync } from "node:child_process";
import type { ToolDefinition, ToolHandler } from "../agent/tools.js";
import type { ToolRegistry } from "../agent/tools.js";

// ── External Skill Types ────────────────────────────────────────────────────

/** A LangChain-compatible tool definition */
export interface LangChainToolDef {
	name: string;
	description: string;
	schema: Record<string, unknown>;
	handler: (args: Record<string, unknown>) => Promise<Record<string, unknown> | string>;
}

/** Configuration for an executor-based skill (shell command) */
export interface ExecutorSkillConfig {
	command: string;
	cwd?: string;
	timeout?: number;
	description?: string;
	/** JSON schema for input arguments → mapped to env vars */
	inputSchema: Record<string, unknown>;
	/** How to pass arguments: "env" | "args" | "stdin" */
	inputMode?: "env" | "args" | "stdin";
}

/** Configuration for an HTTP-based skill */
export interface HttpSkillConfig {
	url: string;
	method?: "GET" | "POST" | "PUT" | "DELETE";
	headers?: Record<string, string>;
	description?: string;
	inputSchema: Record<string, unknown>;
	/** Whether to pass input as JSON body (POST/PUT) or query params (GET/DELETE) */
	passAs?: "body" | "query";
}

// ── Skill Injector ──────────────────────────────────────────────────────────

export class SkillInjector {
	private registry: ToolRegistry;

	constructor(registry: ToolRegistry) {
		this.registry = registry;
	}

	/**
	 * Inject a LangChain-compatible skill.
	 * Wraps the handler function into a ToolDefinition + ToolHandler
	 * and registers it with the ToolRegistry.
	 */
	injectLangChain(skill: LangChainToolDef): void {
		const def: ToolDefinition = {
			name: skill.name,
			description: skill.description,
			parameters: skill.schema as Record<string, unknown>,
		};

		const handler: ToolHandler = async (args: Record<string, unknown>) => {
			try {
				const result = await skill.handler(args);
				const content = typeof result === "string" ? result : JSON.stringify(result, null, 2);
				return { callId: "", name: skill.name, content };
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return { callId: "", name: skill.name, content: "", error: msg };
			}
		};

		this.registry.register(def, handler);
	}

	/**
	 * Inject a skill that executes a shell command.
	 * Arguments are passed to the command via the configured mode.
	 */
	injectExecutor(name: string, config: ExecutorSkillConfig): void {
		const def: ToolDefinition = {
			name,
			description: config.description || `Execute: ${config.command}`,
			parameters: config.inputSchema,
			timeout: config.timeout,
		};

		const handler: ToolHandler = async (args: Record<string, unknown>) => {
			try {
				const cmd = this.buildCommand(config, args);
				const output = execSync(cmd, {
					cwd: config.cwd,
					timeout: config.timeout ?? 30_000,
					encoding: "utf-8",
					env: { ...process.env, ...this.toEnvRecord(args) },
				});
				return { callId: "", name, content: output };
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return { callId: "", name, content: "", error: msg };
			}
		};

		this.registry.register(def, handler);
	}

	/**
	 * Inject a skill that calls an HTTP endpoint.
	 * For POST/PUT, arguments are sent as JSON body.
	 * For GET/DELETE, arguments are sent as query parameters.
	 */
	injectHttp(name: string, config: HttpSkillConfig): void {
		const def: ToolDefinition = {
			name,
			description: config.description || `HTTP ${config.method || "GET"} ${config.url}`,
			parameters: config.inputSchema,
		};

		const handler: ToolHandler = async (args: Record<string, unknown>) => {
			try {
				// Dynamic import — http module is available without dependencies
				const url = new URL(config.url);
				const method = (config.method || "GET").toUpperCase();
				const isBody = config.passAs === "body" || method === "POST" || method === "PUT";
				const headers: Record<string, string> = { ...config.headers };

				let body: string | undefined;

				if (isBody && method !== "GET" && method !== "DELETE") {
					headers["content-type"] = headers["content-type"] || "application/json";
					body = JSON.stringify(args);
				} else {
					// Append args as query parameters
					for (const [key, value] of Object.entries(args)) {
						url.searchParams.set(key, String(value));
					}
				}

				const response = await fetch(url.toString(), {
					method,
					headers,
					body,
				});

				const text = await response.text();
				if (!response.ok) {
					return { callId: "", name, content: "", error: `HTTP ${response.status}: ${text}` };
				}
				return { callId: "", name, content: text };
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return { callId: "", name, content: "", error: msg };
			}
		};

		this.registry.register(def, handler);
	}

	// ── Private ─────────────────────────────────────────────────

	private buildCommand(config: ExecutorSkillConfig, args: Record<string, unknown>): string {
		const mode = config.inputMode || "env";

		switch (mode) {
			case "args": {
				const argStr = Object.entries(args)
					.map(([k, v]) => `--${k}="${String(v)}"`)
					.join(" ");
				return `${config.command} ${argStr}`;
			}
			case "stdin":
			case "env":
			default:
				return config.command;
		}
	}

	private toEnvRecord(args: Record<string, unknown>): Record<string, string> {
		const record: Record<string, string> = {};
		for (const [key, value] of Object.entries(args)) {
			record[key] = String(value);
		}
		return record;
	}
}
