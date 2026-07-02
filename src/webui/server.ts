/**
 * WebUI HTTP Server
 *
 * Serves the frontend + REST API.
 *
 * ── Routing Scheme ───────────────────────────────────────────────────────────
 * All /api/* routes are delegated to WebUIBackend.handleRequest(),
 * which has a unified RouteEntry-based router. The backend handles:
 *   - Sessions, messages, tools, cron, config, health, stats,
 *     analytics, themes, providers CRUD, skills CRUD
 *
 * server.ts only handles:
 *   - OPTIONS (CORS preflight)
 *   - Auth (via auth.ts requireAuth)
 *   - Body parsing (shared)
 *   - Chat streaming (POST /api/chat/completions — needs ServerResponse)
 *   - Static frontend (/, /index.html)
 *   - File serving (via sendFile)
 *
 * This keeps the routing split minimal:
 *   backend.ts  → route table (return APIResponse)
 *   server.ts   → HTTP concerns + streaming
 */

import { mkdirSync } from "node:fs";
import {
	createServer,
	type IncomingMessage,
	type ServerResponse,
} from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { registerDefaultProviders } from "../providers/index.js";
import { createAuthenticator } from "./auth.js";
import { WebUIBackend } from "./backend.js";
import { handleChatCompletion } from "./chat-handler.js";
import { FRONTEND_HTML } from "./frontend.js";
import { parseBody, sendFile, sendJson } from "./helpers.js";
import { ProviderManager } from "./provider-manager.js";
import { SkillManager } from "./skill-manager.js";
import type { WebUIConfig } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CSP Header ──────────────────────────────────────────────────────────────

/** Content-Security-Policy for frontend and API responses */
const CSP_HEADER =
	"default-src 'self'; " +
	"script-src 'self' 'unsafe-inline'; " +
	"style-src 'self' 'unsafe-inline'; " +
	"img-src 'self' data: https:; " +
	"connect-src 'self' ws: wss: https:; " +
	"font-src 'self' data:; " +
	"object-src 'none'; " +
	"base-uri 'self'; " +
	"form-action 'self';";

// ── Server ──────────────────────────────────────────────────────────────────

export class WebUIServer {
	private config: WebUIConfig;
	private backend: WebUIBackend;
	private providerManager: ProviderManager;
	private skillManager: SkillManager;
	private server: ReturnType<typeof createServer> | null = null;

	constructor(config: WebUIConfig, workspaceDirOverride?: string) {
		this.config = config;
		const workspaceDir =
			workspaceDirOverride !== undefined
				? workspaceDirOverride
				: process.env.SYNTHTEK_WORKSPACE || process.cwd();
		const configDir = join(workspaceDir, "config");
		// Ensure dirs exist
		try {
			mkdirSync(configDir, { recursive: true });
		} catch {
			console.error(
				`[WebUIServer] Failed to create config directory: ${configDir}`,
			);
		}
		this.providerManager = new ProviderManager(workspaceDir);
		this.skillManager = new SkillManager(
			join(workspaceDir, "skills"),
			configDir,
		);
		this.backend = new WebUIBackend(
			config,
			workspaceDir,
			this.providerManager,
			this.skillManager,
		);
	}

	async start(): Promise<void> {
		await this.backend.start();
		registerDefaultProviders();

		const auth = createAuthenticator({ apiKey: this.config.apiKey ?? "" });

		const handleRequest = async (req: IncomingMessage, res: ServerResponse) => {
			// CORS preflight
			if (req.method === "OPTIONS") {
				res.writeHead(204, {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type",
				});
				return res.end();
			}

			const url = new URL(req.url || "/", `http://${req.headers.host}`);
			const path = url.pathname;
			const queryString = url.searchParams.toString();

			// API routes
			if (path.startsWith("/api/")) {
				// Require authentication for non-public endpoints
				if (!auth.requireAuth(req, res)) return;

				// Parse body for POST/PUT
				let body: unknown = {};
				if (req.method === "POST" || req.method === "PUT") {
					try {
						body = JSON.parse(await parseBody(req));
					} catch {
						body = {};
					}
				}

				// Chat completion (streaming — needs ServerResponse)
				if (req.method === "POST" && path === "/api/chat/completions") {
					return handleChatCompletion(
						req,
						res,
						body,
						this.providerManager,
						this.backend,
					);
				}

				// Delegate all other API routes to the backend's unified router
				const response = this.backend.handleRequest(
					req.method!,
					path,
					body,
					queryString,
				);
				return sendJson(res, response.status, response.body);
			}

			// Serve frontend for everything else
			if (path === "/" || path === "/index.html") {
				res.writeHead(200, {
					"Content-Type": "text/html; charset=utf-8",
					"Content-Security-Policy": CSP_HEADER,
					"X-Content-Type-Options": "nosniff",
					"X-Frame-Options": "DENY",
					"Cache-Control": "no-cache, no-store, must-revalidate",
					Pragma: "no-cache",
					Expires: "0",
				});
				return res.end(FRONTEND_HTML);
			}

			// Try to serve static file from dist/src/webui/ (for future asset support)
			const filePath = join(__dirname, path);
			sendFile(res, filePath);
		};

		this.server = createServer(handleRequest);
		this.server.listen(this.config.port, this.config.host, () => {
			console.log(
				`[webui] Server running at http://${this.config.host}:${this.config.port}`,
			);
		});
	}

	async stop(): Promise<void> {
		await this.backend.stop();
		if (this.server) {
			return new Promise((resolve) =>
				this.server?.close(() => resolve(undefined)),
			);
		}
	}

	get backendInstance(): WebUIBackend {
		return this.backend;
	}
}

// ── No direct CLI entry — use `synthtek webui` command instead ───────────────
