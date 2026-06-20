/**
 * PluginManager
 * Orchestrates the full plugin lifecycle: discover → load → init → run → teardown.
 * Includes error boundaries so one plugin crash doesn't kill the agent.
 */

import type { EventEmitter } from "node:events";
import { PluginDiscoverer } from "./discovery.js";
import { PluginLoader } from "./loader.js";
import type {
	DiscoveredPlugin,
	Logger,
	Plugin,
	PluginConfig,
	IPluginManager as PluginManagerInterface,
	PluginState,
} from "./types.js";

export class PluginManager implements PluginManagerInterface {
	private state = new Map<string, PluginState>();
	private discoverer: PluginDiscoverer;
	private loader: PluginLoader;
	private globalLogger: Logger;
	private globalEvents: EventEmitter;

	constructor(options: {
		config: PluginConfig;
		globalLogger: Logger;
		globalEvents: EventEmitter;
	}) {
		this.globalLogger = options.globalLogger;
		this.globalEvents = options.globalEvents;
		this.discoverer = new PluginDiscoverer(options.config);
		this.loader = new PluginLoader(options);
	}

	async discover(): Promise<DiscoveredPlugin[]> {
		this.globalLogger.info("Discovering plugins...");
		const discovered = await this.discoverer.discover();
		this.globalLogger.info(`Found ${discovered.length} plugin(s)`, {
			plugins: discovered.map((p) => p.name),
		});

		// Update state for discovered plugins
		for (const plugin of discovered) {
			this.state.set(plugin.name, {
				name: plugin.name,
				status: "discovered",
			});
		}

		return discovered;
	}

	async load(discovered: DiscoveredPlugin[]): Promise<Plugin[]> {
		this.globalLogger.info("Loading plugins...");
		const plugins = await this.loader.load(discovered);

		for (const plugin of plugins) {
			this.state.set(plugin.manifest.name, {
				name: plugin.manifest.name,
				status: "loaded",
			});
		}

		this.globalLogger.info(`Loaded ${plugins.length} plugin(s)`, {
			plugins: plugins.map((p) => p.manifest.name),
		});

		return plugins;
	}

	async init(plugins: Plugin[]): Promise<void> {
		this.globalLogger.info("Initializing plugins...");

		// Initialize plugins in order (respecting dependencies)
		for (const plugin of plugins) {
			try {
				await plugin.init();
				this.state.set(plugin.manifest.name, {
					name: plugin.manifest.name,
					status: "initialized",
					loadedAt: new Date(),
				});
				this.globalLogger.info(`Plugin "${plugin.manifest.name}" initialized`);
				this.globalEvents.emit("plugin:initialized", {
					name: plugin.manifest.name,
				});
			} catch (error) {
				this.state.set(plugin.manifest.name, {
					name: plugin.manifest.name,
					status: "error",
					error: error instanceof Error ? error : new Error(String(error)),
				});
				this.globalLogger.error(
					`Plugin "${plugin.manifest.name}" init failed:`,
					{ error: String(error) },
				);
				this.globalEvents.emit("plugin:error", {
					name: plugin.manifest.name,
					error: error instanceof Error ? error.message : String(error),
				});
				// Continue with other plugins — don't fail the whole manager
			}
		}
	}

	async run(plugins: Plugin[]): Promise<void> {
		this.globalLogger.info("Starting plugins...");

		// Start plugins in parallel (they're independent once initialized)
		const promises = plugins.map(async (plugin) => {
			const currentState = this.state.get(plugin.manifest.name);
			if (currentState?.status !== "initialized") {
				this.globalLogger.warn(
					`Skipping start for "${plugin.manifest.name}" — not initialized`,
				);
				return;
			}

			try {
				await plugin.run();
				this.state.set(plugin.manifest.name, {
					name: plugin.manifest.name,
					status: "running",
					startedAt: new Date(),
				});
				this.globalLogger.info(`Plugin "${plugin.manifest.name}" started`);
				this.globalEvents.emit("plugin:started", {
					name: plugin.manifest.name,
				});
			} catch (error) {
				this.state.set(plugin.manifest.name, {
					name: plugin.manifest.name,
					status: "error",
					error: error instanceof Error ? error : new Error(String(error)),
				});
				this.globalLogger.error(
					`Plugin "${plugin.manifest.name}" start failed:`,
					{ error: String(error) },
				);
				this.globalEvents.emit("plugin:error", {
					name: plugin.manifest.name,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		});

		await Promise.all(promises);
	}

	async teardown(plugins: Plugin[]): Promise<void> {
		this.globalLogger.info("Tearing down plugins...");

		// Teardown in reverse order
		const reversed = [...plugins].reverse();
		for (const plugin of reversed) {
			try {
				await plugin.teardown();
				this.state.set(plugin.manifest.name, {
					name: plugin.manifest.name,
					status: "teardown",
					stoppedAt: new Date(),
				});
				this.globalLogger.info(`Plugin "${plugin.manifest.name}" torn down`);
				this.globalEvents.emit("plugin:teardown", {
					name: plugin.manifest.name,
				});
			} catch (error) {
				this.globalLogger.error(
					`Plugin "${plugin.manifest.name}" teardown failed:`,
					{ error: String(error) },
				);
			}
		}
	}

	getState(): Map<string, PluginState> {
		return new Map(this.state);
	}

	isRunning(name: string): boolean {
		const state = this.state.get(name);
		return state?.status === "running";
	}

	getPluginState(name: string): PluginState | undefined {
		return this.state.get(name);
	}
}
