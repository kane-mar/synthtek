/**
 * AgentErrorHandler tests — config defaults and classification
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AgentErrorHandler } from "./error-handler.js";

describe("AgentErrorHandler", () => {
	describe("config defaults", () => {
		it("applies defaults when no config provided", () => {
			const handler = new AgentErrorHandler({});
			// Uses defaults
			assert.equal(handler["maxRetries"], 3);
			assert.equal(handler["initialDelay"], 1000);
			assert.equal(handler["maxDelay"], 30000);
			assert.equal(handler["multiplier"], 2);
			assert.equal(handler["failureThreshold"], 5);
			assert.equal(handler["recoveryTimeout"], 60000);
		});

		it("applies nested defaults for partial retry config", () => {
			const handler = new AgentErrorHandler({
				retry: { maxRetries: 5 },
			});
			assert.equal(handler["maxRetries"], 5);
			assert.equal(handler["initialDelay"], 1000); // default
			assert.equal(handler["maxDelay"], 30000); // default
			assert.equal(handler["multiplier"], 2); // default
		});

		it("applies nested defaults for partial circuitBreaker config", () => {
			const handler = new AgentErrorHandler({
				circuitBreaker: { failureThreshold: 10 },
			});
			assert.equal(handler["failureThreshold"], 10);
			assert.equal(handler["recoveryTimeout"], 60000); // default
		});
	});

	describe("classification", () => {
		it("classifies rate limit errors", () => {
			const handler = new AgentErrorHandler({});
			assert.equal(
				handler.classifyError(new Error("Rate limit exceeded")),
				"rate_limit",
			);
		});

		it("classifies timeout errors", () => {
			const handler = new AgentErrorHandler({});
			assert.equal(
				handler.classifyError(new Error("Request timed out")),
				"timeout",
			);
		});

		it("uses type hint when provided", () => {
			const handler = new AgentErrorHandler({});
			assert.equal(
				handler.classifyError(new Error("anything"), "provider_error"),
				"provider",
			);
		});
	});
});
