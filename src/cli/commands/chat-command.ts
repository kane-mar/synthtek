/**
 * Chat command — TUI chat with the AI agent.
 *
 * Layout:
 *   ┌─────────────────────────────────┐
 *   │  Conversation history            │  ← scrollable content area
 *   │  ...                             │
 *   │                                  │
 *   ├─────────────────────────────────┤  ← separator (1px visual line)
 *   │  Status info (grey)              │
 *   │  Model / provider info (grey)    │
 *   │ > input buffer                   │
 *   └─────────────────────────────────┘
 *
 * Bottom 4 rows are reserved for separator + status + input.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { emitKeypressEvents } from "node:readline";
import type { Command } from "commander";
import { getSystemPrompt } from "../../config/agent-config.js";
import { ChatService } from "../../messaging/chat-service.js";
import type { ChatMessage, LLMProviderConfig } from "../../messaging/types.js";
import { config, logger } from "../cli-context.js";

// ── Provider Loader ──────────────────────────────────────────────────────────

function loadLocalProviders(configDir: string): LLMProviderConfig[] {
	const filePath = join(configDir, "providers.json");
	if (!existsSync(filePath)) return [];
	try {
		const raw = readFileSync(filePath, "utf-8");
		const data = JSON.parse(raw);
		const providers = Array.isArray(data)
			? data
			: (data.providers ?? data ?? []);
		return providers.filter((p: Partial<LLMProviderConfig>) => p.id && p.type);
	} catch {
		return [];
	}
}

// ── Terminal helpers ──────────────────────────────────────────────────────────

const STATUS_ROWS = 4; // rows reserved at the bottom
const SEP_CHAR = "━";

const C = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	green: "\x1b[32m",
	cyan: "\x1b[36m",
	yellow: "\x1b[33m",
	red: "\x1b[31m",
	magenta: "\x1b[35m",
	grey: "\x1b[90m",
} as const;

function color(text: string, code: string): string {
	return `${code}${text}${C.reset}`;
}

function tWidth(): number {
	return process.stdout.columns || 80;
}
function tHeight(): number {
	return process.stdout.rows || 24;
}
function cursorMove(row: number, col: number): void {
	process.stdout.write(`\x1b[${row};${col}H`);
}
function clearLine(): void {
	process.stdout.write("\x1b[2K");
}
function clearScreen(): void {
	process.stdout.write("\x1b[2J\x1b[H");
}
function cursorHide(): void {
	process.stdout.write("\x1b[?25l");
}
function cursorShow(): void {
	process.stdout.write("\x1b[?25h");
}
function setScrollRegion(top: number, bottom: number): void {
	process.stdout.write(`\x1b[${top};${bottom}r`);
}
function resetScrollRegion(): void {
	process.stdout.write("\x1b[r");
}

// ── Message formatting ────────────────────────────────────────────────────────

function formatMessage(msg: ChatMessage): string {
	const name =
		msg.role === "user"
			? color("You", C.green)
			: msg.role === "assistant"
				? color("AI", C.cyan)
				: color("System", C.yellow);

	const lines = msg.content.split("\n");
	const formatted = lines
		.map((line) => {
			if (line.startsWith("```")) return color(line, C.dim);
			if (line.startsWith("|")) return color(line, C.dim);
			return line;
		})
		.join("\n");

	return `${color(SEP_CHAR.repeat(40), C.dim)}\n${name}:\n${formatted}`;
}

// ── Chat TUI ──────────────────────────────────────────────────────────────────

class ChatTUI {
	private history: ChatMessage[] = [];
	private inputBuffer = "";
	private cursorPos = 0;
	private statusText = "";
	private isWaiting = false;
	private done = false;

	private chat: ChatService;
	private systemPrompt: string;
	private model?: string;
	private resolvePromise!: () => void;

	constructor(chat: ChatService, systemPrompt: string, model?: string) {
		this.chat = chat;
		this.systemPrompt = systemPrompt;
		this.model = model;
	}

	/** Start the TUI. Returns a promise that resolves when the user exits. */
	async start(): Promise<void> {
		this.setup();
		await new Promise<void>((resolve) => {
			this.resolvePromise = resolve;
		});
	}

	// ── Setup / Teardown ───────────────────────────────────────────

	private setup(): void {
		cursorHide();
		clearScreen();
		this.setScrollRegion();
		this.statusText = "Ready";
		this.drawBottomBar();

		// Keypress handling
		emitKeypressEvents(process.stdin);
		if (process.stdin.isTTY) process.stdin.setRawMode(true);
		process.stdin.on("keypress", this.onKeypress.bind(this));

		// Terminal resize
		process.stdout.on("resize", () => {
			this.setScrollRegion();
			this.drawBottomBar();
		});

		// Welcome message
		this.writeRaw(
			`${color("🚀 Synthtek Chat", C.magenta)} ${color(`(${this.model || "default"})`, C.dim)}`,
		);
		this.writeRaw(
			color("Type /help for commands. Ctrl+C or /exit to quit.", C.dim),
		);
		this.writeRaw("");

		this.drawBottomBar();
		this.moveToInput();
	}

	private shutdown(): void {
		if (this.done) return;
		this.done = true;
		process.stdin.removeAllListeners("keypress");
		if (process.stdin.isTTY) process.stdin.setRawMode(false);
		resetScrollRegion();
		cursorShow();
		clearScreen();
		this.resolvePromise();
	}

	// ── Scroll region ───────────────────────────────────────────────

	private setScrollRegion(): void {
		const h = tHeight();
		const scrollBottom = Math.max(1, h - STATUS_ROWS);
		setScrollRegion(1, scrollBottom);
	}

	// ── Bottom bar rendering ───────────────────────────────────────

	private drawBottomBar(): void {
		const h = tHeight();
		const w = tWidth();
		const barTop = Math.max(1, h - STATUS_ROWS + 1);

		// Row 1 of bar: separator line (1px visual line using full block chars)
		cursorMove(barTop, 1);
		clearLine();
		// Use the upper half block character for a thin 1px-high line
		process.stdout.write(SEP_CHAR.repeat(w));

		// Row 2 of bar: primary status (grey)
		cursorMove(barTop + 1, 1);
		clearLine();
		const spinner = this.isWaiting ? "⏳ " : "  ";
		process.stdout.write(
			color(`${spinner}${this.statusText}`, C.grey),
		);

		// Row 3 of bar: secondary status (model info, grey)
		cursorMove(barTop + 2, 1);
		clearLine();
		const modelInfo = this.model
			? `Model: ${this.model}`
			: "";
		const msgCount = this.history.length
			? `Messages: ${Math.ceil(this.history.length / 2)}`
			: "";
		const parts = [modelInfo, msgCount].filter(Boolean);
		process.stdout.write(color(` ${parts.join("  •  ")}`, C.dim));

		// Row 4 of bar: input line
		this.drawInputLine();
	}

	private drawInputLine(): void {
		const h = tHeight();
		const inputRow = h; // bottommost row
		cursorMove(inputRow, 1);
		clearLine();
		const prefix = this.isWaiting ? "" : "> ";
		process.stdout.write(`${prefix}${this.inputBuffer}`);
		this.moveToInput();
	}

	private moveToInput(): void {
		const h = tHeight();
		cursorMove(h, 3 + Math.min(this.cursorPos, this.inputBuffer.length));
	}

	private updateStatusOnly(): void {
		const h = tHeight();
		const barTop = Math.max(1, h - STATUS_ROWS + 1);

		// Update status line
		cursorMove(barTop + 1, 1);
		clearLine();
		const spinner = this.isWaiting ? "⏳ " : "  ";
		process.stdout.write(color(`${spinner}${this.statusText}`, C.grey));

		// Update secondary status
		cursorMove(barTop + 2, 1);
		clearLine();
		const modelInfo = this.model ? `Model: ${this.model}` : "";
		const msgCount = this.history.length
			? `Messages: ${Math.ceil(this.history.length / 2)}`
			: "";
		const parts = [modelInfo, msgCount].filter(Boolean);
		process.stdout.write(color(` ${parts.join("  •  ")}`, C.dim));

		this.drawInputLine();
	}

	// ── Content writing ────────────────────────────────────────────

	/** Write a line into the scrollable content area. */
	private writeRaw(text: string): void {
		const h = tHeight();
		const scrollBottom = Math.max(1, h - STATUS_ROWS);
		// Move to the bottom of the scrollable region and write
		cursorMove(scrollBottom, 1);
		process.stdout.write(text + "\n");
		// After writing, the scroll region may have scrolled.
		// Redraw the bottom bar so it's not clobbered.
		this.drawBottomBar();
	}

	/** Write multiple lines of text, splitting on \n. */
	private writeContent(text: string): void {
		const lines = text.split("\n");
		for (const line of lines) {
			this.writeRaw(line);
		}
	}

	// ── Keypress handling ──────────────────────────────────────────

	private onKeypress(_str: string, key: { name?: string; ctrl?: boolean }): void {
		if (this.done) return;

		// Ctrl+C
		if ((key.ctrl && key.name === "c") || key.name === "escape") {
			if (this.isWaiting) {
				// Cancel in-progress request
				this.isWaiting = false;
				this.statusText = "Cancelled";
				this.updateStatusOnly();
				this.drawInputLine();
			} else {
				this.shutdown();
			}
			return;
		}

		// Ignore input while waiting for response
		if (this.isWaiting) return;

		// Enter
		if (key.name === "return" || key.name === "enter") {
			this.submit();
			return;
		}

		// Backspace
		if (key.name === "backspace") {
			if (this.cursorPos > 0) {
				this.inputBuffer =
					this.inputBuffer.slice(0, this.cursorPos - 1) +
					this.inputBuffer.slice(this.cursorPos);
				this.cursorPos--;
				this.drawInputLine();
			}
			return;
		}

		// Delete
		if (key.name === "delete") {
			if (this.cursorPos < this.inputBuffer.length) {
				this.inputBuffer =
					this.inputBuffer.slice(0, this.cursorPos) +
					this.inputBuffer.slice(this.cursorPos + 1);
				this.drawInputLine();
			}
			return;
		}

		// Arrow left
		if (key.name === "left") {
			if (this.cursorPos > 0) {
				this.cursorPos--;
				this.moveToInput();
			}
			return;
		}

		// Arrow right
		if (key.name === "right") {
			if (this.cursorPos < this.inputBuffer.length) {
				this.cursorPos++;
				this.moveToInput();
			}
			return;
		}

		// Home
		if (key.name === "home") {
			this.cursorPos = 0;
			this.moveToInput();
			return;
		}

		// End
		if (key.name === "end") {
			this.cursorPos = this.inputBuffer.length;
			this.moveToInput();
			return;
		}

		// Tab (completion or just ignore)
		if (key.name === "tab") {
			return;
		}

		// Regular printable characters
		if (_str && _str.length === 1 && _str.charCodeAt(0) >= 32) {
			this.inputBuffer =
				this.inputBuffer.slice(0, this.cursorPos) +
				_str +
				this.inputBuffer.slice(this.cursorPos);
			this.cursorPos++;
			this.drawInputLine();
		}
	}

	// ── Submitting input ───────────────────────────────────────────

	private async submit(): Promise<void> {
		const trimmed = this.inputBuffer.trim();
		this.inputBuffer = "";
		this.cursorPos = 0;

		if (!trimmed) {
			this.drawInputLine();
			return;
		}

		// Built-in commands
		if (trimmed === "/exit" || trimmed === "/quit") {
			this.shutdown();
			return;
		}

		if (trimmed === "/clear") {
			this.history = [];
			clearScreen();
			this.setScrollRegion();
			this.drawBottomBar();
			this.writeContent(color("— Cleared —", C.dim));
			return;
		}

		if (trimmed === "/help") {
			this.writeContent(
				[
					color("Commands:", C.bold),
					`  ${color("/exit, /quit", C.green)} — Exit the chat`,
					`  ${color("/clear", C.green)} — Clear conversation`,
					`  ${color("/help", C.green)} — Show this help`,
				].join("\n"),
			);
			return;
		}

		// User message
		this.history.push({ role: "user", content: trimmed });
		this.writeContent(formatMessage(this.history[this.history.length - 1]));
		this.writeContent("");

		// Send to LLM
		this.isWaiting = true;
		this.statusText = "Thinking...";
		this.updateStatusOnly();

		try {
			const result = await this.chat.sendMessage({
				messages: [...this.history],
				system: this.systemPrompt,
			});

			if (result.error) {
				this.writeContent(color(`✖ Error: ${result.error}`, C.red));
			} else {
				const assistantMsg: ChatMessage = {
					role: "assistant",
					content: result.content,
				};
				this.history.push(assistantMsg);
				this.writeContent(formatMessage(assistantMsg));
				this.writeContent("");
			}
		} catch (err) {
			this.writeContent(
				color(
					`✖ Error: ${err instanceof Error ? err.message : "Unknown error"}`,
					C.red,
				),
			);
		}

		this.isWaiting = false;
		this.statusText = "Ready";
		this.updateStatusOnly();
	}
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

					if (providers.length === 0) {
						logger.error(
							"No active LLM providers configured. Go to Settings to add one.",
						);
						process.exit(1);
					}

					const activeProvider =
						providers.find((p) => p.status === "active") || providers[0];

					// Create the unified chat service
					// In single-message mode we use the active provider directly.
					// In interactive mode we use the TUI.
					const chat = new ChatService(
						{
							list: () => providers,
							find: (id: string) =>
								providers.find((p) => p.id === id) || null,
							getActiveProvider: (providerId?: string) => {
								if (providerId) {
									return providers.find((p) => p.id === providerId) ?? null;
								}
								return activeProvider;
							},
						},
						{
							completionHandler: async (_provider, messages) => {
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
						const tui = new ChatTUI(chat, systemPrompt, opts.model);
						await tui.start();
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
