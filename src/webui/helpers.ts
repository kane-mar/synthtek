/**
 * WebUI Helpers
 * Utility functions for the WebUI HTTP server.
 * Extracted from server.ts for modularity (H9).
 */
import { readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";

// ─── MIME Types ─────────────────────────────────────────────────────────────

export const MIME_TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "application/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".jpg": "image/jpeg",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
};

// ─── Response Helpers ────────────────────────────────────────────────────────

/**
 * Send a JSON response.
 */
export function sendJson(
	res: ServerResponse,
	status: number,
	body: unknown,
): void {
	const json = JSON.stringify(body);
	res.writeHead(status, {
		"Content-Type": "application/json",
		"Access-Control-Allow-Origin": "*",
		"Content-Length": Buffer.byteLength(json),
		"Cache-Control": "no-cache, no-store, must-revalidate",
		Pragma: "no-cache",
		Expires: "0",
	});
	res.end(json);
}

/**
 * Send a file response.
 */
export function sendFile(res: ServerResponse, filePath: string): void {
	try {
		const content = readFileSync(filePath);
		const ext = join(".", filePath.split(".").pop() || "");
		const mime = MIME_TYPES[ext] || "application/octet-stream";
		res.writeHead(200, {
			"Content-Type": mime,
			"Access-Control-Allow-Origin": "*",
		});
		res.end(content);
	} catch {
		res.writeHead(404, { "Content-Type": "text/plain" });
		res.end("Not found");
	}
}

/**
 * Parse request body as text.
 */
export function parseBody(req: IncomingMessage): Promise<string> {
	return new Promise((resolve) => {
		let body = "";
		req.on("data", (chunk: string) => {
			body += chunk;
		});
		req.on("end", () => {
			resolve(body);
		});
	});
}
