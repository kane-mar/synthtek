/**
 * WebUI Authentication Middleware
 *
 * Handles API key authentication for the WebUI server.
 * Allows same-origin requests without auth headers.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson } from "./helpers.js";

export interface AuthConfig {
	apiKey: string;
}

export interface Authenticator {
	/**
	 * Check if the request is authenticated.
	 * Returns true if the request is allowed.
	 */
	authenticate(req: IncomingMessage): boolean;

	/**
	 * Check if the request is same-origin.
	 */
	isSameOrigin(req: IncomingMessage): boolean;

	/**
	 * Return 401 if not authenticated. Returns true if allowed.
	 */
	requireAuth(req: IncomingMessage, res: ServerResponse): boolean;
}

/**
 * Create an authenticator for the WebUI server.
 */
export function createAuthenticator(config: AuthConfig): Authenticator {
	const publicEndpoints = ["/api/health", "/api/config", "/api/plugins"];

	function isPublic(path: string): boolean {
		return publicEndpoints.some(
			(ep) => path === ep || path.startsWith(`${ep}?`),
		);
	}

	function isSameOrigin(req: IncomingMessage): boolean {
		const origin = req.headers.origin || "";
		const host = req.headers.host || "";
		return (
			origin !== "" &&
			host !== "" &&
			(origin === `http://${host}` || origin === `https://${host}`)
		);
	}

	function authenticate(req: IncomingMessage): boolean {
		if (!config.apiKey) return true; // No key = no auth required
		const authHeader = req.headers.authorization || "";
		return authHeader.replace("Bearer ", "") === config.apiKey;
	}

	function requireAuth(req: IncomingMessage, res: ServerResponse): boolean {
		// Public endpoints don't need auth
		const url = new URL(req.url || "/", `http://${req.headers.host}`);
		if (isPublic(url.pathname)) return true;

		// Same-origin requests are allowed
		if (isSameOrigin(req)) return true;

		// Check auth header
		if (authenticate(req)) return true;

		sendJson(res, 401, { error: "Unauthorized" });
		return false;
	}

	return { authenticate, isSameOrigin, requireAuth };
}
