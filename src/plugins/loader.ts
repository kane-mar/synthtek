/**
 * Plugin Loader
 * Validates config, resolves dependencies, and loads plugins.
 */

import { EventEmitter } from 'node:events';
import { join } from 'node:path';
import type {
  Plugin,
  PluginContext,
  DiscoveredPlugin,
  PluginConfig,
  Logger,
} from './types.js';

export class PluginLoader {
  private globalLogger: Logger;
  private globalEvents: EventEmitter;
  private config: PluginConfig;

  constructor(options: {
    config: PluginConfig;
    globalLogger: Logger;
    globalEvents: EventEmitter;
  }) {
    this.config = options.config;
    this.globalLogger = options.globalLogger;
    this.globalEvents = options.globalEvents;
  }

  async load(discovered: DiscoveredPlugin[]): Promise<Plugin[]> {
    // Validate dependencies
    this.validateDependencies(discovered);

    // Resolve load order (topological sort)
    const ordered = this.resolveLoadOrder(discovered);

    // Load each plugin
    const plugins: Plugin[] = [];
    for (const plugin of ordered) {
      try {
        const loaded = await this.loadPlugin(plugin);
        plugins.push(loaded);
      } catch (error) {
        this.globalLogger.error(`Failed to load plugin "${plugin.name}":`, { error: String(error) });
      }
    }

    return plugins;
  }

  /**
   * Validate that all declared dependencies are present.
   */
  private validateDependencies(discovered: DiscoveredPlugin[]): void {
    const names = new Set(discovered.map((p) => p.name));

    for (const plugin of discovered) {
      if (!plugin.manifest.requires) continue;

      for (const dep of plugin.manifest.requires) {
        if (!names.has(dep)) {
          throw new Error(
            `Plugin "${plugin.name}" requires "${dep}", but it was not found.`
          );
        }
      }
    }
  }

  /**
   * Topological sort of plugins based on dependency order.
   */
  private resolveLoadOrder(discovered: DiscoveredPlugin[]): DiscoveredPlugin[] {
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const plugin of discovered) {
      graph.set(plugin.name, plugin.manifest.requires || []);
      inDegree.set(plugin.name, (plugin.manifest.requires || []).length);
    }

    // Kahn's algorithm
    const queue: string[] = [];
    for (const [name, degree] of inDegree) {
      if (degree === 0) queue.push(name);
    }

    const result: DiscoveredPlugin[] = [];
    const nameToPlugin = new Map(discovered.map((p) => [p.name, p]));

    while (queue.length > 0) {
      const name = queue.shift()!;
      result.push(nameToPlugin.get(name)!);

      for (const plugin of discovered) {
        const deps = graph.get(plugin.name) || [];
        if (deps.includes(name)) {
          const newDegree = (inDegree.get(plugin.name) || 0) - 1;
          inDegree.set(plugin.name, newDegree);
          if (newDegree === 0) {
            queue.push(plugin.name);
          }
        }
      }
    }

    if (result.length !== discovered.length) {
      throw new Error('Circular dependency detected among plugins.');
    }

    return result;
  }

  /**
   * Load a single plugin from its discovered state.
   */
  private async loadPlugin(discovered: DiscoveredPlugin): Promise<Plugin> {
    const pluginConfig = this.config.overrides[discovered.name] || {};

    // Validate config against schema if present
    if (this.config.validateConfig && discovered.manifest.configSchema) {
      this.validateConfig(discovered.name, pluginConfig as Record<string, unknown>, discovered.manifest.configSchema);
    }
    const context: PluginContext = {
      config: pluginConfig,
      logger: this.createPluginLogger(discovered.name),
      emit: (event: string, data: unknown) => this.globalEvents.emit(event, data),
      on: (event: string, handler: (data: unknown) => void) =>
        this.globalEvents.on(event, handler),
      events: new EventEmitter(),
    };

    // Dynamically import the plugin
    const mainModule = discovered.manifest.main || 'dist/index.js';
    const pluginPath = join(discovered.path, mainModule);

    try {
      const module = await import(pluginPath);
      const plugin = module.default || module;

      if (typeof plugin !== 'object' || typeof plugin.init !== 'function') {
        throw new Error(`Plugin "${discovered.name}" does not export a valid plugin object.`);
      }

      return {
        manifest: discovered.manifest,
        context,
        init: plugin.init.bind(plugin),
        run: plugin.run.bind(plugin),
        teardown: plugin.teardown.bind(plugin),
      };
    } catch (error) {
      throw new Error(
        `Failed to import plugin "${discovered.name}" from ${pluginPath}: ${error}`
      );
    }
  }

  /**
   * Simple config validation against JSON Schema (basic implementation).
   */
  private validateConfig(
    name: string,
    config: Record<string, unknown>,
    schema: Record<string, unknown>
  ): void {
    const required = (schema.required as string[]) || [];
    for (const field of required) {
      if (!(field in config)) {
        throw new Error(
          `Plugin "${name}" config missing required field: "${field}"`
        );
      }
    }

    const properties = schema.properties as Record<string, { type: string }> | undefined;
    if (properties) {
      for (const [field, prop] of Object.entries(properties)) {
        if (field in config && prop.type) {
          const value = config[field];
          const actualType = Array.isArray(value) ? 'array' : typeof value;
          if (actualType !== prop.type) {
            throw new Error(
              `Plugin "${name}" config field "${field}" expected type "${prop.type}", got "${actualType}"`
            );
          }
        }
      }
    }
  }

  /**
   * Create a logger scoped to a specific plugin.
   */
  private createPluginLogger(pluginName: string): Logger {
    const prefix = `[${pluginName}]`;

    return {
      debug: (msg: string, meta?: Record<string, unknown>) =>
        this.globalLogger.debug(`${prefix} ${msg}`, { ...meta, plugin: pluginName }),
      info: (msg: string, meta?: Record<string, unknown>) =>
        this.globalLogger.info(`${prefix} ${msg}`, { ...meta, plugin: pluginName }),
      warn: (msg: string, meta?: Record<string, unknown>) =>
        this.globalLogger.warn(`${prefix} ${msg}`, { ...meta, plugin: pluginName }),
      error: (msg: string, meta?: Record<string, unknown>) =>
        this.globalLogger.error(`${prefix} ${msg}`, { ...meta, plugin: pluginName }),
    };
  }
}
