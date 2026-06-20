/**
 * WebUI command — start the web interface server
 */

import type { Command } from "commander";
import { WebUIServer } from "../../webui/server.js";
import { logger } from "../cli-context.js";

export function registerWebuiCommand(program: Command): void {
	program
		.command("webui")
		.description("Start the web interface server")
		.option(
			"--host <host>",
			"Host to bind to",
			process.env.WEBUI_HOST || "0.0.0.0",
		)
		.option(
			"--port <port>",
			"Port to listen on",
			process.env.WEBUI_PORT || "8080",
		)
		.action(async (opts: { host?: string; port?: string }) => {
			const webuiConfig = {
				host: opts.host || "0.0.0.0",
				port: parseInt(opts.port || "8080", 10),
				apiKey: process.env.WEBUI_API_KEY || "",
				maxSessions: parseInt(process.env.WEBUI_MAX_SESSIONS || "100", 10),
				sessionTimeout: parseInt(
					process.env.WEBUI_SESSION_TIMEOUT || "3600",
					10,
				),
			};

			const server = new WebUIServer(webuiConfig);
			await server.start();

			logger.info("WebUI started", {
				host: webuiConfig.host,
				port: webuiConfig.port,
			});

			// Graceful shutdown
			process.on("SIGINT", async () => {
				logger.info("Shutting down WebUI...");
				await server.stop();
				process.exit(0);
			});

			process.on("SIGTERM", async () => {
				logger.info("Shutting down WebUI...");
				await server.stop();
				process.exit(0);
			});
		});
}
