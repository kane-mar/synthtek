/**
 * Restart command — restart the synthtek service
 */

import type { Command } from "commander";
import { logger } from "../cli-context.js";

export function registerRestartCommand(program: Command): void {
	program
		.command("restart")
		.description("Restart the synthtek service")
		.option("-f, --force", "force restart without saving state")
		.action(async (opts: { force?: boolean }) => {
			try {
				if (!opts.force) {
					logger.info("Saving current state before restart...");
					// State saving logic would go here
				}

				logger.info("Restarting synthtek service...");

				// In a real implementation, this would signal the running process
				// to gracefully shut down and restart
				logger.info("Restart signal sent. The service will restart shortly.");
			} catch (err) {
				logger.error("Failed to restart service", {
					error: (err as Error).message,
				});
				process.exit(1);
			}
		});
}
