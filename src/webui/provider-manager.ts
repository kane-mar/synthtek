/**
 * LLM Provider Manager
 *
 * CRUD for LLM provider configurations persisted to a JSON file.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

// ── Types ────────────────────────────────────────────────────────────────────

export type ProviderType = 'openai' | 'anthropic' | 'openrouter' | 'ollama' | 'lm-studio' | 'llamacpp' | 'custom';
export type ProviderStatus = 'active' | 'inactive' | 'error';

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
  openai: { baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'], defaultModel: 'gpt-4o' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514'], defaultModel: 'claude-sonnet-4-20250514' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', models: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet'], defaultModel: 'openai/gpt-4o' },
  ollama: { baseUrl: 'http://localhost:11434/v1', models: [], defaultModel: '', apiKey: '' },
  'lm-studio': { baseUrl: 'http://localhost:1234/v1', models: [], defaultModel: '', apiKey: '' },
  llamacpp: { baseUrl: 'http://localhost:8080/v1', models: [], defaultModel: '', apiKey: '' },
  custom: { baseUrl: '', models: [], defaultModel: '', apiKey: '' },
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
    this.dataPath = join(workspaceDir, 'config', 'providers.json');
  }

  // ── Persistence ────────────────────────────────────────────────────────

  load(): void {
    if (this.loaded) return;
    try {
      if (existsSync(this.dataPath)) {
        const raw = readFileSync(this.dataPath, 'utf-8');
        const data: LLMProviderConfig[] = JSON.parse(raw);
        for (const p of data) this.providers.set(p.id, p);
      }
    } catch {
      // Start fresh if file is corrupt
      this.providers.clear();
    }
    this.loaded = true;
  }

  save(): void {
    const data: LLMProviderConfig[] = Array.from(this.providers.values());
    mkdirSync(dirname(this.dataPath), { recursive: true });
    writeFileSync(this.dataPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  // ── CRUD ───────────────────────────────────────────────────────────────

  list(): LLMProviderConfig[] {
    this.load();
    return Array.from(this.providers.values());
  }

  get(id: string): LLMProviderConfig | undefined {
    this.load();
    return this.providers.get(id);
  }

  create(req: CreateProviderRequest): LLMProviderConfig {
    this.load();
    const preset = PROVIDER_PRESETS[req.type] || {};
    const now = Date.now();
    const provider: LLMProviderConfig = {
      id: generateId(),
      name: req.name,
      type: req.type,
      status: 'active',
      baseUrl: req.baseUrl || preset.baseUrl || '',
      apiKey: req.apiKey ?? preset.apiKey,
      models: req.models.length > 0 ? req.models : (preset.models || []),
      defaultModel: req.defaultModel || preset.defaultModel || '',
      temperature: req.temperature ?? 0.7,
      maxTokens: req.maxTokens ?? 4096,
      timeoutMs: req.timeoutMs ?? 60_000,
      headers: req.headers || {},
      createdAt: now,
      updatedAt: now,
    };
    this.providers.set(provider.id, provider);
    this.save();
    return provider;
  }

  update(id: string, req: UpdateProviderRequest): LLMProviderConfig | null {
    this.load();
    const existing = this.providers.get(id);
    if (!existing) return null;

    Object.assign(existing, { ...req, updatedAt: Date.now() });
    this.save();
    return existing;
  }

  delete(id: string): boolean {
    this.load();
    const removed = this.providers.delete(id);
    if (removed) this.save();
    return removed;
  }

  // ── Presets ────────────────────────────────────────────────────────────

  getPresets(): Record<ProviderType, Partial<LLMProviderConfig>> {
    return PROVIDER_PRESETS;
  }
}
