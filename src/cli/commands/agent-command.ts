/**
 * Agent command — agent lifecycle management
 */

import { Command } from "commander";
import { AgentLoop } from "../../agent/index.js";
import { logger } from "../cli-context.js";

export function registerAgentCommand(program: Command): void {
	program
		.command("agent")
		.description("Agent lifecycle management")
		.addCommand(
			new Command("start")
				.description("Start the agent")
				.option("-m, --model <model>", "LLM model to use")
				.option("-p, --prompt <prompt>", "system prompt")
				.option("-t, --temperature <temp>", "temperature", "0.7")
				.action(
					async (opts: {
						model?: string;
						prompt?: string;
						temperature?: string;
					}) => {
						try {
							const agent = new AgentLoop({
								systemPrompt: opts.prompt || "You are a helpful AI assistant.",
								maxToolCalls: 20,
								model: opts.model,
								temperature: parseFloat(opts.temperature || "0.7"),
							});
							await agent.start();
							logger.info("Agent started successfully");
						} catch (err) {
							logger.error("Failed to start agent", {
								error: (err as Error).message,
							});
							process.exit(1);
						}
					},
				),
		)
		.addCommand(
			new Command("stop").description("Stop the agent").action(async () => {
				logger.info("Agent stop signal sent");
			}),
		)
		.addCommand(
			new Command("status").description("Show agent status").action(() => {
				logger.info("Agent status", {
					status: "running",
					model: "default",
					temperature: 0.7,
				});
			}),
		)
		.addCommand(
			new Command("chat")
				.description("Chat with the agent")
				.argument("<message>", "message to send")
				.option("-m, --model <model>", "LLM model to use")
				.action(async (message: string, opts: { model?: string }) => {
					try {
						const agent = new AgentLoop({
							systemPrompt: "You are a helpful AI assistant.",
							maxToolCalls: 20,
							model: opts.model,
						});
						await agent.start();
						const result = await agent.processMessageWithCallback(
							{ role: "user", content: message },
							async (_messages) => {
								return {
									content:
										"Agent is running. Configure an LLM provider for real responses.",
									totalTokens: 0,
								};
							},
						);
						console.log(result.response);
						await agent.stop();
					} catch (err) {
						logger.error("Agent chat failed", {
							error: (err as Error).message,
						});
						process.exit(1);
					}
				}),
		);
}
