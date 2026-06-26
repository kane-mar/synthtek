/**
 * Chat command — unified interactive TUI chat with the AI agent.
 *
 * Uses ChatService for consistent message processing across all interfaces.
 * Provides an interactive readline loop with loading indicators,
 * error handling, and conversation history.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { Command } from "commander";
import { getSystemPrompt } from "../../config/agent-config.js";
import { ChatService } from "../../messaging/chat-service.js";
import type { ChatMessage, LLMProviderConfig } from "../../messaging/types.js";
import { config, logger } from "../cli-context.js";

// ── Provider Loader ──────────────────────────────────────────────────────────
// Reads provider config from the same file the WebUI uses

function loadLocalProviders(configDir: string): LLMProviderConfig[] {
	const filePath = join(configDir, "providers.json");
	if (!existsSync(filePath)) return [];
	try {
		const raw = readFileSync(filePath, "utf-8");
		const data = JSON.parse(raw);
		// Support both array and { providers: [...] } format
		const providers = Array.isArray(data)
			? data
			: (data.providers ?? data ?? []);
		return providers.filter((p: Partial<LLMProviderConfig>) => p.id && p.type);
	} catch {
		return [];
	}
}

// ── Colors / Terminal helpers ────────────────────────────────────────────────

const COLORS = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	green: "\x1b[32m",
	cyan: "\x1b[36m",
	yellow: "\x1b[33m",
	red: "\x1b[31m",
	magenta: "\x1b[35m",
} as const;

function color(text: string, c: string): string {
	return `${c}${text}${COLORS.reset}`;
}

// ── Spinner ──────────────────────────────────────────────────────────────────

const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

class Spinner {
	private frame = 0;
	private interval: ReturnType<typeof setInterval> | null = null;
	private message = "";

	start(message: string): void {
		this.message = message;
		this.frame = 0;
		process.stdout.write("\n");
		this.interval = setInterval(() => {
			this.tick();
		}, 80);
	}

	private tick(): void {
		const f = spinnerFrames[this.frame % spinnerFrames.length];
		process.stdout.write(
			`\x1b[1A\x1b[2K${color(f, COLORS.cyan)} ${this.message}\n`,
		);
		this.frame++;
	}

	stop(): void {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
		process.stdout.write(`\x1b[1A\x1b[2K`);
	}

	succeed(text: string): void {
		this.stop();
		console.log(`${color("✔", COLORS.green)} ${text}`);
	}

	fail(text: string): void {
		this.stop();
		console.log(`${color("✖", COLORS.red)} ${text}`);
	}
}

// ── Message formatter ────────────────────────────────────────────────────────
// Simple terminal-friendly output (no HTML, plain text with basic formatting)

function formatMessage(msg: ChatMessage): string {
	const name =
		msg.role === "user"
			? color("You", COLORS.green)
			: msg.role === "assistant"
				? color("AI", COLORS.cyan)
				: color("System", COLORS.yellow);

	const lines = msg.content.split("\n");
	// For code blocks, preserve formatting with dim coloring
	const formatted = lines
		.map((line) => {
			if (line.startsWith("```")) return color(line, COLORS.dim);
			if (line.startsWith("|")) return color(line, COLORS.dim);
			return line;
		})
		.join("\n");

	return `${color("━".repeat(40), COLORS.dim)}\n${name}:\n${formatted}\n`;
}

// ── Interactive Chat ─────────────────────────────────────────────────────────

async function startInteractiveChat(
	chat: ChatService,
	systemPrompt: string,
	model?: string,
): Promise<void> {
	const spinner = new Spinner();
	const history: ChatMessage[] = [];
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: true,
	});

	console.log(
		`\n${color("🚀 Synthtek Chat", COLORS.magenta)} ${color(`(${model || "default"})`, COLORS.dim)}`,
	);
	console.log(
		`${color("Type your messages below. Press Ctrl+C or type /exit to quit.", COLORS.dim)}\n`,
	);

	const ask = (): void => {
		rl.question(color("You: ", COLORS.green), async (input: string) => {
			const trimmed = input.trim();
			if (!trimmed) {
				ask();
				return;
			}

			// Commands
			if (trimmed === "/exit" || trimmed === "/quit") {
				console.log(color("Goodbye!", COLORS.dim));
				rl.close();
				return;
			}
			if (trimmed === "/clear") {
				history.length = 0;
				console.clear();
				ask();
				return;
			}
			if (trimmed === "/help") {
				console.log(`${color("/exit, /quit", COLORS.cyan)} — Exit the chat`);
				console.log(
					`${color("/clear", COLORS.cyan)} — Clear conversation history`,
				);
				console.log(`${color("/help", COLORS.cyan)} — Show this help`);
				ask();
				return;
			}

			// Add to history and send
			history.push({ role: "user" as const, content: trimmed });
			spinner.start(color("Thinking...", COLORS.dim));

			try {
				const result = await chat.sendMessage({
					messages: [...history],
					system: systemPrompt,
				});

				spinner.stop();

				if (result.error) {
					console.log(`${color("✖ Error:", COLORS.red)} ${result.error}`);
				} else {
					const assistantMsg: ChatMessage = {
						role: "assistant",
						content: result.content,
					};
					history.push(assistantMsg);
					console.log(formatMessage(assistantMsg));
				}
			} catch (err) {
				spinner.fail(
					`Failed: ${err instanceof Error ? err.message : "Unknown error"}`,
				);
			}

			ask();
		});
	};

	ask();

	// Wait for readline to close before resolving
	await new Promise<void>((resolve) => rl.on("close", resolve));
}

// ── Register Command ─────────────────────────────────────────────────────────

export function registerChatCommand(program: Command): void {
	program
		.command("chat")
		.description("Chat with the AI agent (interactive TUI)")
		.argument("[message]", "single message (omit for interactive mode)")
		.option("-m, --model <model>", "LLM model to use")
		.option("-p, --prompt <prompt>", "system prompt (default: from config)")
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
					const wsDir = (config.get("workspace") as string) || process.cwd();
					const providers = loadLocalProviders(wsDir);
					const systemPrompt =
						opts.prompt || getSystemPrompt() || "You are a helpful assistant.";

					// Create the unified chat service
					const chat = new ChatService(
						{
							list: () => providers,
							find: (id: string) => providers.find((p) => p.id === id) || null,
						},
						{
							completionHandler: async (_provider, messages) => {
								// For now, fall back to single-message AgentLoop
								// Full provider-integrated completion handler coming next
								const { AgentLoop } = await import("../../agent/index.js");
								const agent = new AgentLoop({
									systemPrompt,
									maxToolCalls: 20,
									model: opts.model,
								});
								await agent.start();
								try {
									const result = await agent.processMessageWithCallback(
										messages[messages.length - 1] as {
											role: "user" | "assistant" | "system";
											content: string;
										},
										async (_msgs) => ({
											content:
												"Agent is running. Configure an LLM provider for real responses.",
											totalTokens: 0,
										}),
									);
									return { content: result.response };
								} finally {
									await agent.stop();
								}
							},
						},
					);

					if (message) {
						// Single message mode
						const result = await chat.sendMessage({
							messages: [{ role: "user", content: message }],
							system: systemPrompt,
						});
						if (result.error) {
							logger.error(result.error);
						} else {
							console.log(result.content);
						}
					} else {
						// Interactive TUI mode
						await startInteractiveChat(chat, systemPrompt, opts.model);
					}
				} catch (err) {
					logger.error("Chat failed", {
						error: (err as Error).message,
					});
					process.exit(1);
				}
			},
		);
}
