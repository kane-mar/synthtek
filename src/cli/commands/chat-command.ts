/**
 * Chat command — interactive chat with the agent
 */

import type { Command } from "commander";
import { AgentLoop } from "../../agent/index.js";
import { logger } from "../cli-context.js";

export function registerChatCommand(program: Command): void {
	program
		.command("chat")
		.description("Chat with the AI agent")
		.argument("[message]", "initial message (omit for interactive mode)")
		.option("-m, --model <model>", "LLM model to use")
		.option("-p, --prompt <prompt>", "system prompt")
		.option("-s, --stream", "enable streaming output")
		.action(
			async (
				message: string | undefined,
				opts: {
					model?: string;
					prompt?: string;
					stream?: boolean;
				},
			) => {
				try {
					const agent = new AgentLoop({
						systemPrompt: opts.prompt || "You are a helpful AI assistant.",
						maxToolCalls: 20,
						model: opts.model,
					});

					await agent.start();

					if (message) {
						// Single message mode
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
					} else {
						// Interactive mode (placeholder)
						logger.info(
							'Interactive chat mode not yet implemented. Use: synthtek chat "your message"',
						);
					}

					await agent.stop();
				} catch (err) {
					logger.error("Chat failed", { error: (err as Error).message });
					process.exit(1);
				}
			},
		);
}
