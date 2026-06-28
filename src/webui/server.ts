/**
 * WebUI HTTP Server
 *
 * Wraps WebUIBackend with a real Node.js HTTP server and serves the frontend.
 * Routes are delegated to specialized handler modules.
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
import { handleProviderRoutes } from "./provider-routes.js";
import { SkillManager } from "./skill-manager.js";
import { handleSkillRoutes } from "./skill-routes.js";
import type { WebUIConfig } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
				: process.env.SYNTHTEK_WORKSPACE || "/data";
		this.backend = new WebUIBackend(config, workspaceDir);
		const configDir = join(workspaceDir, "config");
		// Ensure dirs exist
		try {
			mkdirSync(configDir, { recursive: true });
		} catch {}
		this.providerManager = new ProviderManager(workspaceDir);
		this.skillManager = new SkillManager(
			join(workspaceDir, "skills"),
			configDir,
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

				// Provider CRUD routes
				if (
					handleProviderRoutes(
						req.method!,
						path,
						body,
						res,
						this.providerManager,
					)
				) {
					return;
				}

				// Skill routes
				if (
					handleSkillRoutes(req.method!, path, body, res, this.skillManager)
				) {
					return;
				}

				// Chat completion
				if (req.method === "POST" && path === "/api/chat/completions") {
					return handleChatCompletion(
						req,
						res,
						body,
						this.providerManager,
						this.backend,
					);
				}

				// Delegate all remaining API routes to the backend's router
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
