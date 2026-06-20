/**
 * Test server entry point for Playwright E2E tests
 */

import { WebUIServer } from "./server.js";

const webuiConfig = {
	host: "0.0.0.0",
	port: 8080,
	apiKey: "",
	maxSessions: 100,
	sessionTimeout: 3600,
};

const server = new WebUIServer(webuiConfig);
server
	.start()
	.then(() => {
		console.log("WebUI test server started on port 8080");
	})
	.catch((err) => {
		console.error("Failed to start WebUI test server:", err);
		process.exit(1);
	});
