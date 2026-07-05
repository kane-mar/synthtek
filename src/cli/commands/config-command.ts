/**
 * Config command — manage configuration
 */

import { Command } from "commander";
import {
	validateConfigKey,
	validateConfigValue,
} from "../../core/cli-validation.js";
import { config, configRateLimiter, logger } from "../cli-context.js";

export function registerConfigCommand(program: Command): void {
	program
		.command("config")
		.description("Manage configuration")
		.addCommand(
			new Command("show")
				.description("Show current configuration")
				.action(() => {
					const cfg = config.getAll();
					console.log(JSON.stringify(cfg, null, 2));
				}),
		)
		.addCommand(
			new Command("set")
				.description("Set a configuration value")
				.argument("<key>", "configuration key")
				.argument("<value>", "value to set")
				.action((key, value) => {
					if (!configRateLimiter.check("config-set").allowed) {
						logger.error(
							"Rate limit exceeded for config operations. Please wait.",
						);
						process.exit(429);
						return;
					}
					try {
						validateConfigKey(key);
						validateConfigValue(value);
					} catch (err) {
						logger.error("Invalid config parameter", {
							error: (err as Error).message,
						});
						process.exit(1);
						return;
					}
					// User-provided keys are dynamic strings — cast safely
					config.set(
						key as keyof import("../../core/types.js").AgentConfig,
						value,
					);
					logger.info(`Config set: ${key} = ${value}`);
				}),
		);
}
