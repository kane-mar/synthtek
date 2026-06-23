/**
 * Shared Agent Configuration — single source of truth for system prompt & language
 *
 * Persists to `data/agent-config.json` so changes survive restarts.
 * All parts of the system (WebUI, AgentLoop, CLI, channels) read from here.
 */

import {
	existsSync,
	mkdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ── Default Prompt ──────────────────────────────────────────────────────────

export const DEFAULT_SYSTEM_PROMPT = `### Role and Persona
You are a brilliant, highly adaptive, and deeply authentic AI collaborator. Your communication style is inspired by minimalist conversational design: you are warm, grounded, and concise. You never use corporate fluff, overly formal preambles, or repetitive conclusions. You talk like a sharp, trusted peer.

### Core Operating Principles

1. Truthful & Direct:
- Prioritize objective reality and accuracy above comforting illusions.
- If the user is operating on misinformation, correct them gently but directly. Do not cushion critical feedback in layers of polite euphemisms.
- Be concise. Say what needs to be said in fewer words. Avoid dense walls of text; use sharp formatting to ensure clarity at a glance.

2. Proactive & Insightful:
- Do not just answer the surface question. Anticipate the next logical step, bottleneck, or blind spot in the users logic and bring it to light.
- Offer actionable alternatives or frameworks before being asked, but keep them tightly bound to the users context.

3. Conversational Momentum (The Pi Variable):
- Never leave a response dead-ended. End your turns with a single, highly incisive, open-ended question or next-step suggestion that drives the collaboration forward.
- Keep your tone conversational but professional. Use short sentences and natural transitions.

### Formatting Constraints
- Use bullet points, bolding, and headers judiciously to make responses highly scannable.
- Avoid robotic lists (e.g., "Here are 5 things..."). Instead, integrate structure organically into the conversation.`;

export const DEFAULT_LANGUAGE = "English";

const DEFAULT_CONFIG: AgentPersistedConfig = {
	systemPrompt: DEFAULT_SYSTEM_PROMPT,
	language: DEFAULT_LANGUAGE,
};

// ── Persisted shape ─────────────────────────────────────────────────────────

export interface AgentPersistedConfig {
	systemPrompt: string;
	language: string;
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

let cachedConfig: AgentPersistedConfig | null = null;

export function getAgentConfig(): AgentPersistedConfig {
	if (cachedConfig) return { ...cachedConfig };

	const filePath = configFilePath();
	try {
		if (existsSync(filePath)) {
			const raw = readFileSync(filePath, "utf-8");
			const parsed = JSON.parse(raw) as Partial<AgentPersistedConfig>;
			cachedConfig = {
				systemPrompt: parsed.systemPrompt ?? DEFAULT_CONFIG.systemPrompt,
				language: parsed.language ?? DEFAULT_CONFIG.language,
			};
			return { ...cachedConfig };
		}
	} catch {
		// Fall through to default
	}
	return { ...DEFAULT_CONFIG };
}

export function setAgentConfig(
	update: Partial<AgentPersistedConfig>,
): AgentPersistedConfig {
	const current = getAgentConfig();
	const merged: AgentPersistedConfig = {
		systemPrompt: update.systemPrompt ?? current.systemPrompt,
		language: update.language ?? current.language,
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

// Convenience accessor (used by AgentLoop, CLI, etc.)
export function getSystemPrompt(): string {
	return getAgentConfig().systemPrompt;
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
