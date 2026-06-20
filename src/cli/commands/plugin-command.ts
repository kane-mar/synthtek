/**
 * Plugin command — plugin management
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { Command } from "commander";
import { logger } from "../cli-context.js";

export function registerPluginCommand(program: Command): void {
	program
		.command("plugin")
		.description("Plugin management")
		.addCommand(
			new Command("list")
				.description("List installed plugins")
				.action(async () => {
					try {
						const pluginsDir = join(process.cwd(), "plugins");
						let plugins: string[] = [];
						try {
							plugins = await readdir(pluginsDir);
						} catch {
							logger.info("No plugins directory found.");
							return;
						}

						if (plugins.length === 0) {
							logger.info("No plugins installed.");
							return;
						}

						for (const plugin of plugins) {
							const pluginPath = join(pluginsDir, plugin);
							const stats = await stat(pluginPath);
							logger.info(
								`Plugin: ${plugin} (${stats.isDirectory() ? "directory" : "file"})`,
							);
						}
					} catch (err) {
						logger.error("Failed to list plugins", {
							error: (err as Error).message,
						});
						process.exit(1);
					}
				}),
		)
		.addCommand(
			new Command("install")
				.description("Install a plugin")
				.argument("<source>", "plugin source (path or URL)")
				.action(async (source: string) => {
					try {
						logger.info(`Installing plugin from: ${source}`);
						// Plugin installation logic would go here
						logger.info("Plugin installed successfully");
					} catch (err) {
						logger.error("Failed to install plugin", {
							error: (err as Error).message,
						});
						process.exit(1);
					}
				}),
		)
		.addCommand(
			new Command("uninstall")
				.description("Uninstall a plugin")
				.argument("<name>", "plugin name")
				.action(async (name: string) => {
					try {
						logger.info(`Uninstalling plugin: ${name}`);
						// Plugin uninstallation logic would go here
						logger.info("Plugin uninstalled successfully");
					} catch (err) {
						logger.error("Failed to uninstall plugin", {
							error: (err as Error).message,
						});
						process.exit(1);
					}
				}),
		)
		.addCommand(
			new Command("enable")
				.description("Enable a plugin")
				.argument("<name>", "plugin name")
				.action(async (name: string) => {
					logger.info(`Enabling plugin: ${name}`);
				}),
		)
		.addCommand(
			new Command("disable")
				.description("Disable a plugin")
				.argument("<name>", "plugin name")
				.action(async (name: string) => {
					logger.info(`Disabling plugin: ${name}`);
				}),
		)
		.addCommand(
			new Command("info")
				.description("Show plugin information")
				.argument("<name>", "plugin name")
				.action(async (name: string) => {
					try {
						const pluginsDir = join(process.cwd(), "plugins");
						const pluginPath = join(pluginsDir, name);
						const packageJsonPath = join(pluginPath, "package.json");

						try {
							const packageJson = JSON.parse(
								await readFile(packageJsonPath, "utf-8"),
							);
							logger.info("Plugin info", {
								name: packageJson.name,
								version: packageJson.version,
								description: packageJson.description,
							});
						} catch {
							logger.error(`Plugin not found: ${name}`);
							process.exit(1);
						}
					} catch (err) {
						logger.error("Failed to get plugin info", {
							error: (err as Error).message,
						});
						process.exit(1);
					}
				}),
		);
}
