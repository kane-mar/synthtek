/**
 * Provider API Routes
 *
 * Handles CRUD operations for LLM provider configuration.
 */

import type { ServerResponse } from "node:http";
import { sendJson } from "./helpers.js";
import type {
	CreateProviderRequest,
	ProviderManager,
	UpdateProviderRequest,
} from "./provider-manager.js";

export function handleProviderRoutes(
	method: string,
	path: string,
	body: unknown,
	res: ServerResponse,
	providerManager: ProviderManager,
): boolean {
	// GET /api/providers/presets
	if (method === "GET" && path === "/api/providers/presets") {
		sendJson(res, 200, providerManager.getPresets());
		return true;
	}

	// GET /api/providers
	if (method === "GET" && path === "/api/providers") {
		sendJson(res, 200, providerManager.list());
		return true;
	}

	// POST /api/providers
	if (method === "POST" && path === "/api/providers") {
		const reqData = body as CreateProviderRequest;
		if (!reqData.name || !reqData.type) {
			sendJson(res, 400, { error: "name and type are required" });
			return true;
		}
		const provider = providerManager.create(reqData);
		sendJson(res, 201, provider);
		return true;
	}

	// GET /api/providers/:id
	if (
		method === "GET" &&
		path.startsWith("/api/providers/") &&
		path.split("/").length === 4
	) {
		const id = path.split("/")[3];
		const provider = providerManager.get(id);
		if (provider) {
			sendJson(res, 200, provider);
		} else {
			sendJson(res, 404, { error: "Provider not found" });
		}
		return true;
	}

	// PUT /api/providers/:id
	if (
		method === "PUT" &&
		path.startsWith("/api/providers/") &&
		path.split("/").length === 4
	) {
		const id = path.split("/")[3];
		const reqData = body as UpdateProviderRequest;
		const provider = providerManager.update(id, reqData);
		if (provider) {
			sendJson(res, 200, provider);
		} else {
			sendJson(res, 404, { error: "Provider not found" });
		}
		return true;
	}

	// DELETE /api/providers/:id
	if (
		method === "DELETE" &&
		path.startsWith("/api/providers/") &&
		path.split("/").length === 4
	) {
		const id = path.split("/")[3];
		const deleted = providerManager.delete(id);
		sendJson(res, deleted ? 200 : 404, {});
		return true;
	}

	return false; // Not a provider route
}
