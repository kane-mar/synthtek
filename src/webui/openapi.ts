/**
 * OpenAPI 3.0 specification for the WebUI REST API.
 *
 * Auto-documented from the route table. Update when routes change.
 */

export const OPENAPI_SPEC: Record<string, unknown> = {
	openapi: "3.0.3",
	info: {
		title: "SynthTek WebUI API",
		version: "1.0.0",
		description:
			"REST API for the SynthTek AI agent WebUI. Provides session management, messaging, tool configuration, analytics, and system health.",
		contact: {
			name: "SynthTek Team",
		},
	},
	servers: [
		{
			url: "/",
			description: "Local development server",
		},
	],
	paths: {
		// ── Sessions ──────────────────────────────────────────────────────────
		"/api/sessions": {
			get: {
				summary: "List all active sessions",
				tags: ["Sessions"],
				responses: {
					"200": {
						description: "Array of active sessions",
						content: {
							"application/json": {
								schema: {
									type: "array",
									items: { $ref: "#/components/schemas/Session" },
								},
							},
						},
					},
				},
			},
			post: {
				summary: "Create a new session",
				tags: ["Sessions"],
				requestBody: {
					required: false,
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									userId: {
										type: "string",
										description: "User identifier (defaults to 'anonymous')",
									},
								},
							},
						},
					},
				},
				responses: {
					"201": {
						description: "Session created",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Session" },
							},
						},
					},
					"400": {
						description: "Max sessions reached",
					},
				},
			},
		},
		"/api/sessions/{id}": {
			delete: {
				summary: "Delete a session",
				tags: ["Sessions"],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "string" },
						description: "Session ID",
					},
				],
				responses: {
					"200": { description: "Session deleted" },
					"404": { description: "Session not found" },
				},
			},
		},

		// ── Messages ──────────────────────────────────────────────────────────
		"/api/messages": {
			get: {
				summary: "Get messages for a session",
				tags: ["Messages"],
				parameters: [
					{
						name: "sessionId",
						in: "query",
						required: true,
						schema: { type: "string" },
						description: "Session ID to fetch messages for",
					},
				],
				responses: {
					"200": {
						description: "Array of messages",
						content: {
							"application/json": {
								schema: {
									type: "array",
									items: { $ref: "#/components/schemas/Message" },
								},
							},
						},
					},
				},
			},
			post: {
				summary: "Add a message to a session",
				tags: ["Messages"],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									sessionId: { type: "string" },
									role: {
										type: "string",
										enum: ["user", "assistant", "system"],
									},
									content: { type: "string" },
								},
								required: ["sessionId", "role", "content"],
							},
						},
					},
				},
				responses: {
					"201": {
						description: "Message added",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Message" },
							},
						},
					},
					"404": { description: "Session not found" },
				},
			},
		},

		// ── Tools ─────────────────────────────────────────────────────────────
		"/api/tools": {
			get: {
				summary: "List registered tools",
				tags: ["Tools"],
				responses: {
					"200": {
						description: "Array of tools",
						content: {
							"application/json": {
								schema: {
									type: "array",
									items: { $ref: "#/components/schemas/ToolInfo" },
								},
							},
						},
					},
				},
			},
			post: {
				summary: "Register a new tool",
				tags: ["Tools"],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									name: { type: "string" },
									description: { type: "string" },
									category: { type: "string" },
								},
								required: ["name"],
							},
						},
					},
				},
				responses: {
					"201": {
						description: "Tool created",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/ToolInfo" },
							},
						},
					},
					"400": { description: "Name is required" },
					"409": { description: "Tool already exists" },
				},
			},
		},
		"/api/tools/{name}": {
			delete: {
				summary: "Delete a tool by name",
				tags: ["Tools"],
				parameters: [
					{
						name: "name",
						in: "path",
						required: true,
						schema: { type: "string" },
						description: "Tool name (URL encoded)",
					},
				],
				responses: {
					"200": { description: "Tool deleted" },
					"404": { description: "Tool not found" },
				},
			},
		},

		// ── Cron Jobs ─────────────────────────────────────────────────────────
		"/api/cron": {
			get: {
				summary: "List cron jobs",
				tags: ["Cron"],
				responses: {
					"200": {
						description: "Array of cron jobs",
						content: {
							"application/json": {
								schema: {
									type: "array",
									items: { $ref: "#/components/schemas/CronJob" },
								},
							},
						},
					},
				},
			},
			post: {
				summary: "Create a cron job",
				tags: ["Cron"],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									schedule: { type: "string", description: "Cron expression" },
									message: { type: "string" },
								},
								required: ["schedule", "message"],
							},
						},
					},
				},
				responses: {
					"201": {
						description: "Cron job created",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/CronJob" },
							},
						},
					},
					"400": { description: "Schedule and message required" },
				},
			},
		},
		"/api/cron/{id}": {
			delete: {
				summary: "Delete a cron job",
				tags: ["Cron"],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				responses: {
					"200": { description: "Cron job deleted" },
					"404": { description: "Cron job not found" },
				},
			},
		},

		// ── Agent Config ──────────────────────────────────────────────────────
		"/api/config/agent": {
			get: {
				summary: "Get agent configuration",
				tags: ["Config"],
				responses: {
					"200": {
						description: "Agent config",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/AgentConfig" },
							},
						},
					},
				},
			},
			put: {
				summary: "Update agent configuration",
				tags: ["Config"],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/AgentConfig" },
						},
					},
				},
				responses: {
					"200": {
						description: "Config updated",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/AgentConfig" },
							},
						},
					},
					"400": { description: "Validation error" },
				},
			},
			delete: {
				summary: "Reset agent configuration to defaults",
				tags: ["Config"],
				responses: {
					"200": { description: "Config reset" },
				},
			},
		},

		// ── System Config ─────────────────────────────────────────────────────
		"/api/config": {
			get: {
				summary: "Get sanitized system configuration",
				tags: ["Config"],
				responses: {
					"200": {
						description: "Sanitized config (secrets removed)",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										version: { type: "string" },
										maxSessions: { type: "integer" },
										logLevel: { type: "string" },
									},
								},
							},
						},
					},
				},
			},
		},

		// ── Health & Stats ────────────────────────────────────────────────────
		"/api/health": {
			get: {
				summary: "Health check",
				tags: ["System"],
				responses: {
					"200": {
						description: "Health status",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string", enum: ["ok"] },
										uptime: { type: "number" },
									},
								},
							},
						},
					},
				},
			},
		},
		"/api/stats": {
			get: {
				summary: "Get WebUI statistics",
				tags: ["System"],
				responses: {
					"200": {
						description: "Stats",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/WebUIStats" },
							},
						},
					},
				},
			},
		},

		// ── Analytics ─────────────────────────────────────────────────────────
		"/api/analytics/summary": {
			get: {
				summary: "Get analytics summary",
				tags: ["Analytics"],
				responses: {
					"200": {
						description: "Analytics summary",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/AnalyticsSummary" },
							},
						},
					},
				},
			},
		},
		"/api/analytics/token-usage": {
			get: {
				summary: "Get token usage by hour",
				tags: ["Analytics"],
				responses: {
					"200": {
						description: "Token usage data",
						content: {
							"application/json": {
								schema: {
									type: "array",
									items: {
										type: "object",
										properties: {
											hour: { type: "string" },
											tokens: { type: "integer" },
										},
									},
								},
							},
						},
					},
				},
			},
		},
		"/api/analytics/provider-health": {
			get: {
				summary: "Get provider health status",
				tags: ["Analytics"],
				responses: {
					"200": {
						description: "Provider health data",
						content: {
							"application/json": {
								schema: {
									type: "array",
									items: {
										type: "object",
										properties: {
											provider: { type: "string" },
											status: {
												type: "string",
												enum: ["healthy", "degraded", "down"],
											},
											latency: { type: "number" },
										},
									},
								},
							},
						},
					},
				},
			},
		},

		// ── Themes ────────────────────────────────────────────────────────────
		"/api/themes": {
			get: {
				summary: "List available themes",
				tags: ["Config"],
				responses: {
					"200": {
						description: "Available themes",
						content: {
							"application/json": {
								schema: {
									type: "array",
									items: {
										type: "object",
										properties: {
											id: { type: "string" },
											name: { type: "string" },
										},
									},
								},
							},
						},
					},
				},
			},
		},

		// ── OpenAPI ────────────────────────────────────────────────────────────
		"/api/openapi.json": {
			get: {
				summary: "Get the OpenAPI specification",
				tags: ["System"],
				responses: {
					"200": {
						description: "OpenAPI 3.0.3 specification",
						content: {
							"application/json": {
								schema: {
									type: "object",
								},
							},
						},
					},
				},
			},
		},
	},
	components: {
		schemas: {
			Session: {
				type: "object",
				properties: {
					id: { type: "string" },
					userId: { type: "string" },
					createdAt: { type: "string", format: "date-time" },
					messageCount: { type: "integer" },
				},
			},
			Message: {
				type: "object",
				properties: {
					id: { type: "string" },
					role: { type: "string", enum: ["user", "assistant", "system"] },
					content: { type: "string" },
					timestamp: { type: "string", format: "date-time" },
				},
			},
			ToolInfo: {
				type: "object",
				properties: {
					name: { type: "string" },
					description: { type: "string" },
					category: { type: "string" },
				},
			},
			CronJob: {
				type: "object",
				properties: {
					id: { type: "string" },
					schedule: { type: "string" },
					message: { type: "string" },
					enabled: { type: "boolean" },
				},
			},
			AgentConfig: {
				type: "object",
				properties: {
					systemPrompt: { type: "string" },
					language: { type: "string" },
					maxToolCalls: { type: "integer" },
					maxRetries: { type: "integer" },
					temperature: { type: "number" },
					maxTokens: { type: "integer" },
				},
			},
			WebUIStats: {
				type: "object",
				properties: {
					sessions: { type: "integer" },
					totalMessages: { type: "integer" },
					totalTools: { type: "integer" },
					uptime: { type: "number" },
				},
			},
			AnalyticsSummary: {
				type: "object",
				properties: {
					totalMessages: { type: "integer" },
					totalTokens: { type: "integer" },
					activeSessions: { type: "integer" },
					averageLatency: { type: "number" },
				},
			},
		},
	},
};

/**
 * Returns the OpenAPI spec as a JSON object.
 * This is served at GET /api/openapi.json
 */
export function getOpenApiSpec(): Record<string, unknown> {
	return OPENAPI_SPEC;
}
