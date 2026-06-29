/**
 * Shared Agent Configuration — single source of truth for all agent settings.
 *
 * Persists to `data/agent-config.json` so changes survive restarts.
 * All parts of the system (WebUI, TUI, CLI, all channels) read from here.
 *
 * ── Config layering (priority, high→low) ──────────────────────────────────
 *   1. data/agent-config.json   (runtime, written by WebUI)
 *   2. SYNTHTEK_* env vars      (startup override)
 *   3. synthtek.config.json     (startup file)
 *   4. Built-in defaults        (DEFAULT_SETTINGS below)
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ResponseFormat, ValidationResult } from "./schema.js";

export type { ResponseFormat, ValidationResult };

// ── Schema ──────────────────────────────────────────────────────────────────

/**
 * All agent settings in one place.
 *
 * Every consumer (AgentLoop, AgentSession, TUI, CLI, WebUI, channels)
 * reads from a single AgentSettings object hydrated by getAgentConfig().
 *
 * When adding a new field:
 *  1. Add it here with a JSDoc comment
 *  2. Add a default in DEFAULT_SETTINGS
 *  3. Add a fallback merge in getAgentConfig()
 *  4. Add a merge in setAgentConfig()
 *  5. Add validation in validateAgentSettings()
 *  6. Add an input field in the WebUI frontend
 */
export interface AgentSettings {
	// ── Agent Identity ──────────────────────────────────────────────────────

	/** Core personality and behavior instructions */
	systemPrompt: string;
	/** Response language (e.g. "English", "Chinese") */
	language: string;

	// ── LLM Parameters ─────────────────────────────────────────────────────

	/** Override the provider's default model (optional) */
	model?: string;
	/** Maximum tool-call iterations per user message (1–100) */
	maxToolCalls: number;
	/** Maximum tokens in the LLM's generated response (64–128000) */
	maxTokens: number;
	/** LLM sampling temperature (0.0–2.0). Lower = deterministic. */
	temperature: number;
	/** Nucleus sampling threshold (0.0–1.0). Optional. */
	topP?: number;
	/** Sequences where the LLM stops generating. Optional. */
	stop?: string[];

	// ── Reliability & Retries ───────────────────────────────────────────────

	/** Max retry attempts when an LLM call fails (0–10) */
	maxRetries: number;
	/** Initial retry backoff in milliseconds (>= 100) */
	retryDelay: number;
	/** Maximum retry backoff in milliseconds (>= retryDelay) */
	retryMaxDelay: number;
	/** Exponential backoff multiplier (>= 1) */
	retryMultiplier: number;

	// ── Response ────────────────────────────────────────────────────────────

	/** How the agent formats its responses */
	responseFormat: ResponseFormat;

	// ── Persistence ─────────────────────────────────────────────────────────

	/** Override workspace directory (defaults to CWD or process env) */
	workspaceDir?: string;
	/** Automatically persist conversation history to disk */
	autoPersist: boolean;

	// ── Meta (internal) ─────────────────────────────────────────────────────

	/** Schema version for migration. Bump when shape changes. */
	_schemaVersion: number;
	/** Hash of DEFAULT_SYSTEM_PROMPT at time of save. Stale when code changes. */
	_defaultPromptHash?: string;
}

/**
 * Backward-compatible type alias — use AgentSettings for new code.
 * @deprecated Use AgentSettings instead.
 */
export type AgentPersistedConfig = AgentSettings;

// ── Default Prompt ──────────────────────────────────────────────────────────

export const DEFAULT_SYSTEM_PROMPT = `You are an elite, highly autonomous, and deeply competent AI collaborator. Your communication style is inspired by Pi (pi.ai)—authentic, conversational, and direct—but optimized for high-leverage execution.

Adhere strictly to the following operating principles:

1. Communication Style & Persona
- **Direct & Honest:** Speak with candor. Do not mince words, use corporate jargon, or mask uncertainty with platitudes. If an idea is weak, say so. If a solution is elegant, highlight why.
- **Human & Grounded:** Maintain an authentic, peer-to-peer tone. Avoid the robotic "As an AI..." qualifiers or overly formal pleasantries.
- **Scannable & Concise:** Use bolding, clean bullet points, and headers to make your insights instantly digestible. Avoid dense walls of text.

2. Proactivity & Problem-Solving (The "Ownership" Mandate)
- **Bias for Action:** Do not ask for permission to do your job. When given a problem, present the solution or the first iteration of the asset immediately. Do not say "I can help with that, would you like me to start?"—just start.
- **Anticipate Next Steps:** Look one or two steps ahead of the user's current request. If they ask for a strategy, provide the strategy *and* the immediate execution checklist.
- **No Infinite Loops:** Never end a response with generic, open-ended questions like "What do you want to do next?" or "How can I help you further?". If a question is necessary, make it highly specific, strategic, and aimed at unblocking a decision.

3. Execution Framework
- **Validate & Correct:** If the user presents a premise that is factually flawed or structurally weak, gently but directly correct it like a helpful peer, not a rigid lecturer.
- **Default to Prototypes:** When a task is ambiguous, build a high-fidelity prototype or draft based on your best inference rather than pausing to ask for clarification. It is faster to edit than to build from scratch.
- **Synthesize Context:** Seamlessly integrate existing technical, business, or operational context into your solutions without explicitly pointing out that you are doing so.`;

export const DEFAULT_LANGUAGE = "English";

/**
 * Stale-config detection: when this hash differs from what's stored in the
 * persisted config file, the config is treated as stale and DEFAULT_SETTINGS
 * is returned instead.  Bump this when DEFAULT_SYSTEM_PROMPT changes so that
 * old persisted configs are automatically invalidated.
 */
const DEFAULT_PROMPT_HASH = hashString(DEFAULT_SYSTEM_PROMPT);

export const DEFAULT_SETTINGS: AgentSettings = {
	systemPrompt: DEFAULT_SYSTEM_PROMPT,
	language: DEFAULT_LANGUAGE,
	model: undefined,
	maxToolCalls: 20,
	maxTokens: 4096,
	temperature: 0.7,
	topP: undefined,
	stop: undefined,
	maxRetries: 3,
	retryDelay: 1000,
	retryMaxDelay: 10000,
	retryMultiplier: 2,
	responseFormat: "markdown",
	workspaceDir: undefined,
	autoPersist: true,
	_schemaVersion: 2,
};

// ── Simple string hash

function hashString(s: string): string {
	let h = 0;
	for (let i = 0; i < s.length; i++) {
		h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
	}
	return h.toString(16);
}

// ── Config file path (resolve relative to project root) ──────────────────────

function dataDir(): string {
	// Resolve project root by walking up from this module's location
	const thisFile = fileURLToPath(import.meta.url);
	const distDir = resolve(thisFile, "..");
	const projectRoot = resolve(distDir, "..", "..");
	const candidate = join(projectRoot, "data");
	// Confirm we found the project root (has package.json)
	if (existsSync(join(projectRoot, "package.json"))) {
		return candidate;
	}
	// Fallback: use CWD
	return join(process.cwd(), "data");
}

function configFilePath(): string {
	return join(dataDir(), "agent-config.json");
}

// ── Read / Write ────────────────────────────────────────────────────────────

let cachedConfig: AgentSettings | null = null;

/** Merge a partial parsed file with defaults (handles missing fields gracefully) */
function mergeWithDefaults(parsed: Partial<AgentSettings>): AgentSettings {
	return {
		systemPrompt: parsed.systemPrompt ?? DEFAULT_SETTINGS.systemPrompt,
		language: parsed.language ?? DEFAULT_SETTINGS.language,
		model: parsed.model ?? DEFAULT_SETTINGS.model,
		maxToolCalls: parsed.maxToolCalls ?? DEFAULT_SETTINGS.maxToolCalls,
		maxTokens: parsed.maxTokens ?? DEFAULT_SETTINGS.maxTokens,
		temperature: parsed.temperature ?? DEFAULT_SETTINGS.temperature,
		topP: parsed.topP ?? DEFAULT_SETTINGS.topP,
		stop: parsed.stop ?? DEFAULT_SETTINGS.stop,
		maxRetries: parsed.maxRetries ?? DEFAULT_SETTINGS.maxRetries,
		retryDelay: parsed.retryDelay ?? DEFAULT_SETTINGS.retryDelay,
		retryMaxDelay: parsed.retryMaxDelay ?? DEFAULT_SETTINGS.retryMaxDelay,
		retryMultiplier: parsed.retryMultiplier ?? DEFAULT_SETTINGS.retryMultiplier,
		responseFormat: parsed.responseFormat ?? DEFAULT_SETTINGS.responseFormat,
		workspaceDir: parsed.workspaceDir ?? DEFAULT_SETTINGS.workspaceDir,
		autoPersist: parsed.autoPersist ?? DEFAULT_SETTINGS.autoPersist,
		_schemaVersion: parsed._schemaVersion ?? DEFAULT_SETTINGS._schemaVersion,
	};
}

export function getAgentConfig(): AgentSettings {
	if (cachedConfig) return { ...cachedConfig };

	const filePath = configFilePath();
	try {
		if (existsSync(filePath)) {
			const raw = readFileSync(filePath, "utf-8");
			const parsed = JSON.parse(raw) as Partial<AgentSettings>;
			// Stale detection: if the system prompt hash doesn't match, use defaults.
			// Accept both old `defaultPromptHash` and new `_defaultPromptHash` keys.
			const savedHash = parsed._defaultPromptHash ?? (parsed as any).defaultPromptHash;
			if (savedHash !== undefined && savedHash !== DEFAULT_PROMPT_HASH) {
				cachedConfig = { ...DEFAULT_SETTINGS };
				return { ...cachedConfig };
			}
			cachedConfig = mergeWithDefaults(parsed);
			return { ...cachedConfig };
		}
	} catch {
		// Fall through to default
	}
	return { ...DEFAULT_SETTINGS };
}

export function setAgentConfig(
	update: Partial<AgentSettings>,
): AgentSettings {
	const current = getAgentConfig();
	const merged: AgentSettings = {
		...current,
		...update,
		// Ensure _defaultPromptHash is always set to current hash on save
		_defaultPromptHash: DEFAULT_PROMPT_HASH,
		// Preserve _schemaVersion
		_schemaVersion: current._schemaVersion ?? DEFAULT_SETTINGS._schemaVersion,
	};

	const filePath = configFilePath();
	try {
		// Ensure data directory exists
		const dir = dataDir();
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		writeFileSync(filePath, JSON.stringify(merged, null, 2), "utf-8");
	} catch (err) {
		console.error(`Failed to persist agent config: ${err}`);
	}

	cachedConfig = merged;
	return { ...merged };
}

// Convenience accessors (used by AgentLoop, CLI, etc.)
export function getSystemPrompt(): string {
	return getAgentConfig().systemPrompt;
}

export function getResponseFormat(): ResponseFormat {
	return getAgentConfig().responseFormat;
}

/** Reset cached config so next getAgentConfig() re-reads from disk */
export function resetAgentConfigCache(): void {
	cachedConfig = null;
}

/** Delete the persisted config file (used in tests) */
export function deleteAgentConfigFile(): void {
	cachedConfig = null;
	const filePath = configFilePath();
	try {
		if (existsSync(filePath)) {
			unlinkSync(filePath);
		}
	} catch {
		// ignore
	}
}

/** Reset agent config to defaults and delete persisted file */
export function resetAgentConfig(): AgentSettings {
	deleteAgentConfigFile();
	return { ...DEFAULT_SETTINGS };
}

// ── Validation ──────────────────────────────────────────────────────────────

export function validateAgentSettings(
	settings: Partial<AgentSettings>,
): ValidationResult {
	const errors: string[] = [];

	if (settings.systemPrompt !== undefined && typeof settings.systemPrompt !== "string") {
		errors.push("systemPrompt must be a string");
	}
	if (settings.language !== undefined && typeof settings.language !== "string") {
		errors.push("language must be a string");
	}

	if (settings.model !== undefined && typeof settings.model !== "string") {
		errors.push("model must be a string");
	}

	if (settings.maxToolCalls !== undefined) {
		if (typeof settings.maxToolCalls !== "number" || !Number.isInteger(settings.maxToolCalls)) {
			errors.push("maxToolCalls must be an integer");
		} else if (settings.maxToolCalls < 1 || settings.maxToolCalls > 100) {
			errors.push("maxToolCalls must be between 1 and 100");
		}
	}

	if (settings.maxTokens !== undefined) {
		if (typeof settings.maxTokens !== "number" || !Number.isInteger(settings.maxTokens)) {
			errors.push("maxTokens must be an integer");
		} else if (settings.maxTokens < 64 || settings.maxTokens > 128_000) {
			errors.push("maxTokens must be between 64 and 128000");
		}
	}

	if (settings.temperature !== undefined) {
		if (typeof settings.temperature !== "number") {
			errors.push("temperature must be a number");
		} else if (settings.temperature < 0 || settings.temperature > 2) {
			errors.push("temperature must be between 0.0 and 2.0");
		}
	}

	if (settings.topP !== undefined) {
		if (typeof settings.topP !== "number") {
			errors.push("topP must be a number");
		} else if (settings.topP < 0 || settings.topP > 1) {
			errors.push("topP must be between 0.0 and 1.0");
		}
	}

	if (settings.stop !== undefined && !Array.isArray(settings.stop)) {
		errors.push("stop must be an array of strings");
	}

	if (settings.maxRetries !== undefined) {
		if (typeof settings.maxRetries !== "number" || !Number.isInteger(settings.maxRetries)) {
			errors.push("maxRetries must be an integer");
		} else if (settings.maxRetries < 0 || settings.maxRetries > 10) {
			errors.push("maxRetries must be between 0 and 10");
		}
	}

	if (settings.retryDelay !== undefined) {
		if (typeof settings.retryDelay !== "number" || !Number.isInteger(settings.retryDelay)) {
			errors.push("retryDelay must be an integer");
		} else if (settings.retryDelay < 100) {
			errors.push("retryDelay must be at least 100");
		}
	}

	if (settings.retryMaxDelay !== undefined) {
		if (typeof settings.retryMaxDelay !== "number" || !Number.isInteger(settings.retryMaxDelay)) {
			errors.push("retryMaxDelay must be an integer");
		} else if (settings.retryMaxDelay < (settings.retryDelay ?? 1000)) {
			errors.push("retryMaxDelay must be >= retryDelay");
		}
	}

	if (settings.retryMultiplier !== undefined) {
		if (typeof settings.retryMultiplier !== "number") {
			errors.push("retryMultiplier must be a number");
		} else if (settings.retryMultiplier < 1) {
			errors.push("retryMultiplier must be at least 1");
		}
	}

	if (settings.responseFormat !== undefined) {
		const validFormats: ResponseFormat[] = ["markdown", "json", "plain", "structured"];
		if (!validFormats.includes(settings.responseFormat as ResponseFormat)) {
			errors.push(`responseFormat must be one of: ${validFormats.join(", ")}`);
		}
	}

	if (settings.workspaceDir !== undefined && typeof settings.workspaceDir !== "string") {
		errors.push("workspaceDir must be a string");
	}

	if (settings.autoPersist !== undefined && typeof settings.autoPersist !== "boolean") {
		errors.push("autoPersist must be a boolean");
	}

	return { valid: errors.length === 0, errors };
}
