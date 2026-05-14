/**
 * Secret management — secure storage and retrieval of API keys and tokens
 */



// ── Secret storage backends ──────────────────────────────────────────────────

interface SecretStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  delete(key: string): boolean;
  has(key: string): boolean;
  list(): string[];
}

/** In-memory secret store (default) */
class MemorySecretStore implements SecretStore {
  private secrets: Map<string, string> = new Map();

  get(key: string): string | null {
    return this.secrets.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.secrets.set(key, value);
  }

  delete(key: string): boolean {
    return this.secrets.delete(key);
  }

  has(key: string): boolean {
    return this.secrets.has(key);
  }

  list(): string[] {
    return Array.from(this.secrets.keys());
  }
}

// ── Secret manager ───────────────────────────────────────────────────────────

export interface SecretManager {
  get(key: string): string | null;
  set(key: string, value: string): void;
  delete(key: string): boolean;
  has(key: string): boolean;
  list(): string[];
  clear(): void;
}

export class SecretManagerImpl implements SecretManager {
  private store: SecretStore;
  private prefix: string;

  constructor(store?: SecretStore, prefix: string = 'synthtek') {
    this.store = store ?? new MemorySecretStore();
    this.prefix = prefix;
  }

  private fullKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  get(key: string): string | null {
    return this.store.get(this.fullKey(key));
  }

  set(key: string, value: string): void {
    this.store.set(this.fullKey(key), value);
  }

  delete(key: string): boolean {
    return this.store.delete(this.fullKey(key));
  }

  has(key: string): boolean {
    return this.store.has(this.fullKey(key));
  }

  list(): string[] {
    return this.store.list().map((k) => k.replace(`${this.prefix}:`, ''));
  }

  clear(): void {
    for (const key of this.store.list()) {
      this.store.delete(key);
    }
  }
}

// ── Secret resolution — merges env vars, file secrets, and defaults ─────────

export interface SecretResolver {
  resolve(key: string): string | null;
  resolveRequired(key: string): string;
  resolveAll(keys: string[]): Record<string, string | null>;
}

export class SecretResolverImpl implements SecretResolver {
  private manager: SecretManager;

  constructor(manager?: SecretManager) {
    this.manager = manager ?? new SecretManagerImpl();
  }

  /** Resolve a secret, checking env vars first, then secret store */
  resolve(key: string): string | null {
        // Check environment variable first
        const envKey = key.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
        const envValue = process.env[`SYNTHTEK_${envKey}`];
    if (envValue) return envValue;

    // Check secret store
    return this.manager.get(key);
  }

  /** Resolve a required secret, throwing if not found */
  resolveRequired(key: string): string {
    const value = this.resolve(key);
    if (!value) {
      throw new Error(`Required secret "${key}" not found. Set SYNTHTEK_${key.toUpperCase()} or configure it in your config file.`);
    }
    return value;
  }

  /** Resolve multiple secrets at once */
  resolveAll(keys: string[]): Record<string, string | null> {
    const result: Record<string, string | null> = {};
    for (const key of keys) {
      result[key] = this.resolve(key);
    }
    return result;
  }
}
