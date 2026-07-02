/**
 * Skill API Routes
 *
 * Handles CRUD operations for installed skills.
 * Returns APIResponse objects compatible with WebUIBackend's router.
 */

import type { SkillManager } from "./skill-manager.js";
import type { APIResponse } from "./types.js";

export function handleSkillRoutes(
	method: string,
	path: string,
	body: unknown,
	skillManager: SkillManager,
): { handled: boolean; response?: APIResponse } {
	// GET /api/skills
	if (method === "GET" && path === "/api/skills") {
		return { handled: true, response: { status: 200, body: skillManager.list() } };
	}

	// POST /api/skills/install
	if (method === "POST" && path === "/api/skills/install") {
		const { source } = body as { source?: string };
		if (!source || typeof source !== "string") {
			return { handled: true, response: { status: 400, body: { error: "source is required" } } };
		}
		const result = skillManager.install(source);
		return { handled: true, response: { status: result.success ? 200 : 500, body: result } };
	}

	// POST /api/skills/:name/toggle
	const toggleMatch = path.match(/^\/api\/skills\/([^/]+)\/toggle$/);
	if (toggleMatch && method === "POST") {
		const name = decodeURIComponent(toggleMatch[1]);
		const skill = skillManager.toggle(name);
		if (!skill) {
			return { handled: true, response: { status: 404, body: { error: `Skill "${name}" not found` } } };
		}
		return { handled: true, response: { status: 200, body: skill } };
	}

	// DELETE /api/skills/:name
	const deleteMatch = path.match(/^\/api\/skills\/([^/]+)$/);
	if (deleteMatch && method === "DELETE") {
		const name = decodeURIComponent(deleteMatch[1]);
		const result = skillManager.delete(name);
		return { handled: true, response: { status: result.success ? 200 : 404, body: result } };
	}

	return { handled: false };
}
