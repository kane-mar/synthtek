/**
 * Provider Registry — Manages provider factories and creation
 */

import {
  ProviderFactory,
  ProviderType,
  ProviderConfig,
  LLMProvider,
} from './types.js';

export class ProviderRegistry {
  private factories: Map<ProviderType, ProviderFactory> = new Map();

  /** Register a provider factory */
  register(type: ProviderType, factory: ProviderFactory): void {
    if (this.factories.has(type)) {
      throw new Error(`Provider type "${type}" is already registered`);
    }
    this.factories.set(type, factory);
  }

  /** Create a provider by type */
  create(type: ProviderType, config: ProviderConfig): LLMProvider {
    const factory = this.factories.get(type);
    if (!factory) {
      throw new Error(`Unknown provider type: ${type}`);
    }
    return factory.create(config);
  }

  /** List registered provider types */
  listTypes(): ProviderType[] {
    return Array.from(this.factories.keys());
  }

  /** Check if a provider type is registered */
  has(type: ProviderType): boolean {
    return this.factories.has(type);
  }
}

// ─── Singleton Registry ─────────────────────────────────────────────────────

let registry: ProviderRegistry | null = null;

export function getRegistry(): ProviderRegistry {
  if (!registry) {
    registry = new ProviderRegistry();
  }
  return registry;
}

export function resetRegistry(): void {
  registry = null;
}
