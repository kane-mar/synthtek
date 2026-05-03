/**
 * Plugins barrel export
 */

export type {
  Plugin,
  PluginManifest,
  PluginContext,
  PluginStatus,
  PluginState,
  DiscoveredPlugin,
  PluginConfig,
  Logger,
} from './types.js';

export { PluginDiscoverer } from './discovery.js';
export { PluginLoader } from './loader.js';
export { PluginManager } from './manager.js';
