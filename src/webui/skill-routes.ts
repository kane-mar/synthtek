/**
 * Skill API Routes
 *
 * Handles CRUD operations for installed skills.
 * Routes: GET/POST/DELETE /api/skills, POST /api/skills/:name/toggle
 */

import type { ServerResponse } from "node:http";
import { sendJson } from "./helpers.js";
import type { SkillManager } from "./skill-manager.js";

export function handleSkillRoutes(
	method: string,
	path: string,
	body: unknown,
	res: ServerResponse,
	skillManager: SkillManager,
): boolean {
	// GET /api/skills
	if (method === "GET" && path === "/api/skills") {
		const skills = skillManager.list();
		return sendJson(res, 200, skills), true;
	}

	// POST /api/skills/install
	if (method === "POST" && path === "/api/skills/install") {
		const { source } = body as { source?: string };
		if (!source || typeof source !== "string") {
			return sendJson(res, 400, { error: "source is required" }), true;
		}
		const result = skillManager.install(source);
		const status = result.success ? 200 : 500;
		return sendJson(res, status, result), true;
	}

	// POST /api/skills/:name/toggle
	const toggleMatch = path.match(/^\/api\/skills\/([^/]+)\/toggle$/);
	if (toggleMatch && method === "POST") {
		const name = decodeURIComponent(toggleMatch[1]);
		const skill = skillManager.toggle(name);
		if (!skill) {
			return sendJson(res, 404, { error: `Skill "${name}" not found` }), true;
		}
		return sendJson(res, 200, skill), true;
	}

	// DELETE /api/skills/:name
	const deleteMatch = path.match(/^\/api\/skills\/([^/]+)$/);
	if (deleteMatch && method === "DELETE") {
		const name = decodeURIComponent(deleteMatch[1]);
		const result = skillManager.delete(name);
		const status = result.success ? 200 : 404;
		return sendJson(res, status, result), true;
	}

	return false;
}
