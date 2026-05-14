/**
 * Plugin Discovery
 * Scans directories to find available plugins.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DiscoveredPlugin, PluginConfig } from './types.js';

export class PluginDiscoverer {
  constructor(private config: PluginConfig) {}

  async discover(): Promise<DiscoveredPlugin[]> {
    const discovered: DiscoveredPlugin[] = [];

    for (const dir of this.config.directories) {
      const entries = await this.scanDirectory(dir);
      discovered.push(...entries);
    }

    // Sort by name for deterministic ordering
    discovered.sort((a, b) => a.name.localeCompare(b.name));

    return discovered;
  }

  private async scanDirectory(dir: string): Promise<DiscoveredPlugin[]> {
    const { readdir, stat } = await import('node:fs/promises');

    const entries = await readdir(dir).catch(() => [] as string[]);
    const plugins: DiscoveredPlugin[] = [];

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const statResult = await stat(fullPath);

      if (!statResult.isDirectory()) continue;

      // Look for package.json or plugin manifest
      const packageJsonPath = join(fullPath, 'package.json');
      const manifestPath = join(fullPath, 'plugin.json');

      try {
        const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

        // Check if this is a synthtek plugin
        if (this.isPluginPackage(pkg)) {
          const manifest = this.extractManifest(pkg);
          plugins.push({
            name: manifest.name,
            version: pkg.version || '0.0.0',
            path: fullPath,
            manifest,
            packageJson: pkg,
          });
        }
      } catch {
        // No package.json, try plugin.json
        try {
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
          if (manifest.name && manifest.version) {
            plugins.push({
              name: manifest.name,
              version: manifest.version,
              path: fullPath,
              manifest,
            });
          }
        } catch {
          // Not a plugin, skip silently
        }
      }
    }

    return plugins;
  }

  private isPluginPackage(pkg: Record<string, unknown>): boolean {
    // A package is a plugin if it has synthtek-plugin in keywords
    // or if it has a synthtek field in package.json
    const keywords = pkg.keywords as string[] | undefined;
    if (keywords?.includes('synthtek-plugin')) return true;

    const synthtekField = pkg.synthtek as Record<string, unknown> | undefined;
    if (synthtekField?.type === 'plugin') return true;

    // Also accept packages with "synthtek" in name as potential plugins
    const name = (pkg.name as string) || '';
    if (name.includes('synthtek') || name.includes('st-')) return true;

    return false;
  }

  private extractManifest(pkg: Record<string, unknown>): DiscoveredPlugin['manifest'] {
    const synthtek = pkg.synthtek as Record<string, unknown> | undefined;

    return {
      name: (pkg.name as string) || '',
      version: (pkg.version as string) || '0.0.0',
      description: (pkg.description as string) || synthtek?.description as string | undefined,
      author: (pkg.author as string) || (synthtek?.author as string | undefined),
      requires: (synthtek?.requires as string[]) || undefined,
      configSchema: (synthtek?.configSchema as Record<string, unknown>) || undefined,
      main: (synthtek?.main as string) || pkg.main as string | undefined,
    };
  }
}
