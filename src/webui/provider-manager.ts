/**
 * LLM Provider Manager
 *
 * CRUD for LLM provider configurations persisted to a JSON file.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type ProviderType =
	| "openai"
	| "anthropic"
	| "openrouter"
	| "ollama"
	| "lmstudio"
	| "llamacpp"
	| "deepseek"
	| "qwen"
	| "custom";
export type ProviderStatus = "active" | "inactive" | "error";

export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_MAX_TOKENS = 4096;
export const DEFAULT_TIMEOUT_MS = 60_000;
export const DEFAULT_STATUS: ProviderStatus = "active";

export interface LLMProviderConfig {
	id: string;
	name: string;
	type: ProviderType;
	status: ProviderStatus;
	baseUrl: string;
	apiKey?: string;
	models: string[];
	defaultModel: string;
	temperature: number;
	maxTokens: number;
	timeoutMs: number;
	headers?: Record<string, string>;
	createdAt: number;
	updatedAt: number;
}

export interface CreateProviderRequest {
	name: string;
	type: ProviderType;
	baseUrl: string;
	apiKey?: string;
	models: string[];
	defaultModel: string;
	temperature?: number;
	maxTokens?: number;
	timeoutMs?: number;
	headers?: Record<string, string>;
}

export interface UpdateProviderRequest {
	name?: string;
	type?: ProviderType;
	baseUrl?: string;
	apiKey?: string;
	models?: string[];
	defaultModel?: string;
	temperature?: number;
	maxTokens?: number;
	timeoutMs?: number;
	status?: ProviderStatus;
	headers?: Record<string, string>;
}

// ── Presets for common providers ─────────────────────────────────────────────

const PROVIDER_PRESETS: Record<ProviderType, Partial<LLMProviderConfig>> = {
	openai: {
		baseUrl: "https://api.openai.com/v1",
		models: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
		defaultModel: "gpt-4o",
	},
	anthropic: {
		baseUrl: "https://api.anthropic.com/v1",
		models: ["claude-sonnet-4-20250514", "claude-opus-4-20250514"],
		defaultModel: "claude-sonnet-4-20250514",
	},
	openrouter: {
		baseUrl: "https://openrouter.ai/api/v1",
		models: ["openai/gpt-4o", "anthropic/claude-3.5-sonnet"],
		defaultModel: "openai/gpt-4o",
	},
	ollama: {
		baseUrl: "http://localhost:11434/v1",
		models: [],
		defaultModel: "",
		apiKey: "",
	},
	lmstudio: {
		baseUrl: "http://localhost:1234/v1",
		models: [],
		defaultModel: "",
		apiKey: "",
	},
	llamacpp: {
		baseUrl: "http://localhost:8080/v1",
		models: [],
		defaultModel: "",
		apiKey: "",
	},
	deepseek: {
		baseUrl: "https://api.deepseek.com/v1",
		models: ["deepseek-chat", "deepseek-reasoner"],
		defaultModel: "deepseek-chat",
	},
	qwen: {
		baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
		models: ["qwen-max", "qwen-plus", "qwen-turbo"],
		defaultModel: "qwen-max",
	},
	custom: { baseUrl: "", models: [], defaultModel: "", apiKey: "" },
};

function generateId(): string {
	return `p_${Math.random().toString(36).slice(2, 11)}`;
}

// ── Manager ──────────────────────────────────────────────────────────────────

export class ProviderManager {
	private dataPath: string;
	private providers: Map<string, LLMProviderConfig> = new Map();
	private loaded = false;

	constructor(workspaceDir: string) {
		this.dataPath = join(workspaceDir, "config", "providers.json");
	}

	// ── Preset helpers ──────────────────────────────────────────────────────

	private mergePreset(req: CreateProviderRequest): LLMProviderConfig {
		const preset = PROVIDER_PRESETS[req.type] || {};
		const now = Date.now();
		return {
			id: generateId(),
			name: req.name,
			type: req.type,
			status: DEFAULT_STATUS,
			baseUrl: req.baseUrl || preset.baseUrl || "",
			apiKey: req.apiKey ?? preset.apiKey,
			models: req.models.length > 0 ? req.models : preset.models || [],
			defaultModel: req.defaultModel || preset.defaultModel || "",
			temperature: req.temperature ?? DEFAULT_TEMPERATURE,
			maxTokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
			timeoutMs: req.timeoutMs ?? DEFAULT_TIMEOUT_MS,
			headers: req.headers || {},
			createdAt: now,
			updatedAt: now,
		};
	}

	// ── Persistence ────────────────────────────────────────────────────────

	private ensureLoaded(): void {
		if (this.loaded) return;
		try {
			if (existsSync(this.dataPath)) {
				const raw = readFileSync(this.dataPath, "utf-8");
				const data: LLMProviderConfig[] = JSON.parse(raw);
				for (const p of data) this.providers.set(p.id, p);
			}
		} catch {
			this.providers.clear();
		}
		this.loaded = true;
	}

	private persist(): void {
		const data: LLMProviderConfig[] = Array.from(this.providers.values());
		try {
			const dir = dirname(this.dataPath);
			mkdirSync(dir, { recursive: true });
			const json = JSON.stringify(data, null, 2);
			writeFileSync(this.dataPath, json, "utf-8");
			// Verify the file was written correctly by reading it back
			const written = readFileSync(this.dataPath, "utf-8");
			if (written !== json) {
				console.error(
					`[ProviderManager] Data verification failed for ${this.dataPath}`,
				);
			}
		} catch (error) {
			console.error(
				`[ProviderManager] Failed to persist providers to ${this.dataPath}: ${(error as Error).message}`,
			);
		}
	}

	// ── CRUD ───────────────────────────────────────────────────────────────

	list(): LLMProviderConfig[] {
		this.ensureLoaded();
		return Array.from(this.providers.values());
	}

	get(id: string): LLMProviderConfig | undefined {
		this.ensureLoaded();
		return this.providers.get(id);
	}

	create(req: CreateProviderRequest): LLMProviderConfig {
		this.ensureLoaded();
		const provider = this.mergePreset(req);
		this.providers.set(provider.id, provider);
		this.persist();
		return provider;
	}

	update(id: string, req: UpdateProviderRequest): LLMProviderConfig | null {
		this.ensureLoaded();
		const existing = this.providers.get(id);
		if (!existing) return null;

		const updated: LLMProviderConfig = {
			...existing,
			...req,
			updatedAt: Date.now(),
		};
		this.providers.set(id, updated);
		this.persist();
		return updated;
	}

	delete(id: string): boolean {
		this.ensureLoaded();
		const removed = this.providers.delete(id);
		if (removed) this.persist();
		return removed;
	}

	// ── Presets ────────────────────────────────────────────────────────────

	getPresets(): Record<ProviderType, Partial<LLMProviderConfig>> {
		return PROVIDER_PRESETS;
	}

	/**
	 * Get an active provider by ID, or the first active provider.
	 * Returns null if no active providers are configured.
	 */
	getActiveProvider(providerId?: string): LLMProviderConfig | null {
		this.ensureLoaded();
		const all = Array.from(this.providers.values());
		const active = all.filter((p) => p.status === "active");

		if (active.length === 0) return null;

		if (providerId) {
			return active.find((p) => p.id === providerId) ?? null;
		}

		return active[0] ?? null;
	}
}
