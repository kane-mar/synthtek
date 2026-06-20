/**
 * Plugins barrel export
 */

export { PluginDiscoverer } from "./discovery.js";
export { PluginLoader } from "./loader.js";
export { PluginManager } from "./manager.js";
export type {
	DiscoveredPlugin,
	Logger,
	Plugin,
	PluginConfig,
	PluginContext,
	PluginManifest,
	PluginState,
	PluginStatus,
} from "./types.js";
