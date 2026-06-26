/**
 * Frontend HTML — Served by the WebUI server
 *
 * Extracted from server.ts to keep the server logic separate from the frontend.
 * Loaded at startup from a companion HTML file.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** The full frontend HTML page as a string */
export const FRONTEND_HTML: string = readFileSync(
	join(__dirname, "frontend.html"),
	"utf-8",
);
