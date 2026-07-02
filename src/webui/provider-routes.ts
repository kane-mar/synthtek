/**
 * Provider API Routes
 *
 * Handles CRUD operations for LLM provider configuration.
 * Returns APIResponse objects compatible with WebUIBackend's router.
 */

import type {
	CreateProviderRequest,
	ProviderManager,
	UpdateProviderRequest,
} from "./provider-manager.js";
import type { APIResponse } from "./types.js";

export function handleProviderRoutes(
	method: string,
	path: string,
	body: unknown,
	providerManager: ProviderManager,
): { handled: boolean; response?: APIResponse } {
	// GET /api/providers/presets
	if (method === "GET" && path === "/api/providers/presets") {
		return { handled: true, response: { status: 200, body: providerManager.getPresets() } };
	}

	// GET /api/providers
	if (method === "GET" && path === "/api/providers") {
		return { handled: true, response: { status: 200, body: providerManager.list() } };
	}

	// POST /api/providers
	if (method === "POST" && path === "/api/providers") {
		const reqData = body as CreateProviderRequest;
		if (!reqData.name || !reqData.type) {
			return { handled: true, response: { status: 400, body: { error: "name and type are required" } } };
		}
		const provider = providerManager.create(reqData);
		return { handled: true, response: { status: 201, body: provider } };
	}

	// GET /api/providers/:id
	if (method === "GET" && path.startsWith("/api/providers/") && path.split("/").length === 4) {
		const id = path.split("/")[3];
		const provider = providerManager.get(id);
		if (provider) {
			return { handled: true, response: { status: 200, body: provider } };
		}
		return { handled: true, response: { status: 404, body: { error: "Provider not found" } } };
	}

	// PUT /api/providers/:id
	if (method === "PUT" && path.startsWith("/api/providers/") && path.split("/").length === 4) {
		const id = path.split("/")[3];
		const reqData = body as UpdateProviderRequest;
		const provider = providerManager.update(id, reqData);
		if (provider) {
			return { handled: true, response: { status: 200, body: provider } };
		}
		return { handled: true, response: { status: 404, body: { error: "Provider not found" } } };
	}

	// DELETE /api/providers/:id
	if (method === "DELETE" && path.startsWith("/api/providers/") && path.split("/").length === 4) {
		const id = path.split("/")[3];
		const deleted = providerManager.delete(id);
		return { handled: true, response: { status: deleted ? 200 : 404, body: {} } };
	}

	return { handled: false }; // Not a provider route
}
