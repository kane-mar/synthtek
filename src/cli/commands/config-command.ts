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
					if (!configRateLimiter.check("config-set")) {
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
					config.set(key as any, value as any);
					logger.info(`Config set: ${key} = ${value}`);
				}),
		);
}
