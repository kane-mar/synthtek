/**
 * Configuration service for synthtek
 */

import { ConfigService, AgentConfig } from './types.js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_CONFIG: AgentConfig = {
  name: 'synthtek',
  version: '1.0.0',
  workspace: process.cwd(),
  logLevel: 'info',
  maxExecTimeout: 60,
  maxExecRetries: 3,
  spawnTimeout: 300,
};

export class ConfigServiceImpl implements ConfigService {
  private config: AgentConfig;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
  }

  get<T extends keyof AgentConfig>(key: T): AgentConfig[T] {
    return this.config[key];
  }

  set<T extends keyof AgentConfig>(key: T, value: AgentConfig[T]): void {
    this.config[key] = value;
  }

  getAll(): AgentConfig {
    return { ...this.config };
  }

  async load(configPath?: string): Promise<void> {
    const path = configPath ?? resolve(process.cwd(), '.synthtek-config.json');

    if (!existsSync(path)) {
      return;
    }

    try {
      const raw = readFileSync(path, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;

      for (const key of Object.keys(parsed) as (keyof AgentConfig)[]) {
        const val = parsed[key];
        if (val !== undefined) {
          (this.config as unknown as Record<string, unknown>)[key] = val;
        }
      }
    } catch {
      // Ignore config load errors, use defaults
    }
  }
}
