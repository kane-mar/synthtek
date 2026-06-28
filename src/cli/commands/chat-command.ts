/**
 * Chat command — TUI chat with the AI agent.
 *
 * Layout:
 *   ┌──────────────────────────────────┐
 *   │  Conversation history             │  ← scrollable content area
 *   │  ...                              │
 *   │                                   │
 *   ├━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┤  ← separator
 *   │  Status info (grey)               │
 *   │  Model / provider info (grey)     │
 *   │ > first line of input ...         │
 *   │   second line ...                 │
 *   │   third line ...                  │  ← multi-line input (≥2 lines)
 *   └──────────────────────────────────┘
 *
 * Bottom 6 rows are reserved: separator + 2 status + 3 input lines.
 * Alt+Enter = newline, Enter = submit.
 * Conversations are persisted to a shared store so the WebUI and TUI
 * share the same conversation history.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { emitKeypressEvents } from "node:readline";
import type { Command } from "commander";
import { getSystemPrompt } from "../../config/agent-config.js";
import { ChatService } from "../../messaging/chat-service.js";
import { ConversationStore } from "../../messaging/conversation-store.js";
import type { ChatMessage, LLMProviderConfig } from "../../messaging/types.js";
import { config, logger } from "../cli-context.js";

// ── Provider Loader ──────────────────────────────────────────────────────────

function loadLocalProviders(workspaceDir: string): LLMProviderConfig[] {
	// WebUI saves providers to {workspace}/config/providers.json
	// Legacy location: {workspace}/providers.json
	const candidates = [
		join(workspaceDir, "config", "providers.json"),
		join(workspaceDir, "providers.json"),
	];

	for (const filePath of candidates) {
		if (!existsSync(filePath)) continue;
		try {
			const raw = readFileSync(filePath, "utf-8");
			const data = JSON.parse(raw);
			const providers = Array.isArray(data)
				? data
				: (data.providers ?? data ?? []);
			const valid = providers.filter(
				(p: Partial<LLMProviderConfig>) => p.id && p.type,
			);
			if (valid.length > 0) return valid;
		} catch {
			// Try next candidate
		}
	}
	return [];
}

// ── Terminal helpers ──────────────────────────────────────────────────────────

const STATUS_ROWS = 6; // rows reserved at the bottom: sep + 2 status + 3 input
const INPUT_VISIBLE_LINES = 3; // how many input lines are shown
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
	private conversationId: string | null = null;

	private chat: ChatService;
	private systemPrompt: string;
	private model?: string;
	private store: ConversationStore;
	private resolvePromise!: () => void;

	constructor(
		chat: ChatService,
		systemPrompt: string,
		store: ConversationStore,
		model?: string,
	) {
		this.chat = chat;
		this.systemPrompt = systemPrompt;
		this.store = store;
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

		// Load existing conversation or create a new one
		const convs = this.store.list();
		if (convs.length > 0) {
			const conv = convs[0]; // most recent conversation
			this.conversationId = conv.id;
			// Load history into memory
			for (const m of conv.messages) {
				this.history.push({ role: m.role, content: m.content });
			}
		} else {
			const conv = this.store.create();
			this.conversationId = conv.id;
		}

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

		// Print existing conversation if any
		if (this.history.length > 0) {
			for (const msg of this.history) {
				this.writeRaw(formatMessage(msg));
			}
			this.writeRaw("");
		}

		// Welcome message
		this.writeRaw(
			`${color("🚀 Synthtek Chat", C.magenta)} ${color(`(${this.model || "default"})`, C.dim)}`,
		);
		if (this.history.length === 0) {
			this.writeRaw(
				color("Type /help for commands. Enter = submit, Alt+Enter = newline.", C.dim),
			);
			this.writeRaw("");
		}

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

		// Row 1 of bar: separator
		cursorMove(barTop, 1);
		clearLine();
		process.stdout.write(SEP_CHAR.repeat(w));

		// Row 2 of bar: primary status (grey)
		cursorMove(barTop + 1, 1);
		clearLine();
		const spinner = this.isWaiting ? "⏳ " : "  ";
		process.stdout.write(color(`${spinner}${this.statusText}`, C.grey));

		// Row 3 of bar: secondary status (model info, grey)
		cursorMove(barTop + 2, 1);
		clearLine();
		const modelInfo = this.model ? `Model: ${this.model}` : "";
		const msgCount =
			this.history.length > 0
				? `Msgs: ${Math.ceil(this.history.length / 2)}`
				: "";
		const convCount = this.store.list().length;
		const parts = [modelInfo, msgCount, `${convCount} conversations`].filter(
			Boolean,
		);
		process.stdout.write(color(` ${parts.join("  •  ")}`, C.dim));

		// Rows 4-6: multi-line input area
		this.drawInputLines();
	}

	/** Split input into lines, showing the last INPUT_VISIBLE_LINES. */
	private drawInputLines(): void {
		const h = tHeight();
		const barTop = Math.max(1, h - STATUS_ROWS + 1);
		// Input area starts at row barTop+3
		const inputStart = barTop + 3;

		// Split input buffer into display lines
		const lines = this.inputBuffer.split("\n");
		// Take the last INPUT_VISIBLE_LINES
		const visible = lines.slice(-INPUT_VISIBLE_LINES);
		// Pad to full height
		while (visible.length < INPUT_VISIBLE_LINES) {
			visible.unshift("");
		}

		for (let i = 0; i < INPUT_VISIBLE_LINES; i++) {
			const row = inputStart + i;
			cursorMove(row, 1);
			clearLine();
			const isLastInputLine = i === INPUT_VISIBLE_LINES - 1;
			if (i < INPUT_VISIBLE_LINES - lines.length) {
				// Above actual input — show as empty scroll hint
				continue;
			}

			const content = visible[i] ?? "";
			let prefix = "";
			if (isLastInputLine) {
				prefix = this.isWaiting ? "" : "> ";
			} else {
				prefix = "  ";
			}
			process.stdout.write(`${prefix}${content}`);
		}

		// Place cursor at end of last line
		this.moveToInput();
	}

	private moveToInput(): void {
		const h = tHeight();
		const inputStart = Math.max(1, h - STATUS_ROWS + 1) + 3;
		const lastInputRow = inputStart + INPUT_VISIBLE_LINES - 1;

		// Find the cursor position on the last line
		const lines = this.inputBuffer.split("\n");
		const lastLine = lines[lines.length - 1] ?? "";
		const cursorOnLastLine = Math.min(this.cursorPos, lastLine.length);
		cursorMove(lastInputRow, 3 + cursorOnLastLine);
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
		const msgCount =
			this.history.length > 0
				? `Msgs: ${Math.ceil(this.history.length / 2)}`
				: "";
		const convCount = this.store.list().length;
		const parts = [modelInfo, msgCount, `${convCount} conversations`].filter(
			Boolean,
		);
		process.stdout.write(color(` ${parts.join("  •  ")}`, C.dim));

		this.drawInputLines();
	}

	// ── Content writing ────────────────────────────────────────────

	/** Write a line into the scrollable content area. */
	private writeRaw(text: string): void {
		const h = tHeight();
		const scrollBottom = Math.max(1, h - STATUS_ROWS);
		// Move to the bottom of the scrollable region and write
		cursorMove(scrollBottom, 1);
		process.stdout.write(`${text}\n`);
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

	private onKeypress(
		_str: string,
		key: { name?: string; ctrl?: boolean; meta?: boolean; shift?: boolean },
	): void {
		if (this.done) return;

		// Ctrl+C / escape
		if ((key.ctrl && key.name === "c") || key.name === "escape") {
			if (this.isWaiting) {
				this.isWaiting = false;
				this.statusText = "Cancelled";
				this.updateStatusOnly();
				this.drawInputLines();
			} else {
				this.shutdown();
			}
			return;
		}

		// Ignore input while waiting for response
		if (this.isWaiting) return;

		// Alt+Enter / Meta+Enter = insert newline
		if ((key.meta || key.ctrl) && (key.name === "return" || key.name === "enter")) {
			this.inputBuffer =
				this.inputBuffer.slice(0, this.cursorPos) +
				"\n" +
				this.inputBuffer.slice(this.cursorPos);
			this.cursorPos++;
			this.drawInputLines();
			return;
		}

		// Enter (without Alt/Ctrl) = submit
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
				this.drawInputLines();
			}
			return;
		}

		// Delete
		if (key.name === "delete") {
			if (this.cursorPos < this.inputBuffer.length) {
				this.inputBuffer =
					this.inputBuffer.slice(0, this.cursorPos) +
					this.inputBuffer.slice(this.cursorPos + 1);
				this.drawInputLines();
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

		// Arrow up — skip to previous line boundary
		if (key.name === "up") {
			const before = this.inputBuffer.slice(0, this.cursorPos);
			const prevNewline = before.lastIndexOf("\n");
			if (prevNewline >= 0) {
				this.cursorPos = prevNewline;
			} else {
				this.cursorPos = 0;
			}
			this.moveToInput();
			return;
		}

		// Arrow down — skip to next line boundary
		if (key.name === "down") {
			const after = this.inputBuffer.slice(this.cursorPos);
			const nextNewline = after.indexOf("\n");
			if (nextNewline >= 0) {
				this.cursorPos += nextNewline + 1;
			} else {
				this.cursorPos = this.inputBuffer.length;
			}
			this.moveToInput();
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

		// Tab
		if (key.name === "tab") {
			// Insert 2 spaces for indentation
			this.inputBuffer =
				this.inputBuffer.slice(0, this.cursorPos) +
				"  " +
				this.inputBuffer.slice(this.cursorPos);
			this.cursorPos += 2;
			this.drawInputLines();
			return;
		}

		// Regular printable characters
		if (_str && _str.length === 1 && _str.charCodeAt(0) >= 32) {
			this.inputBuffer =
				this.inputBuffer.slice(0, this.cursorPos) +
				_str +
				this.inputBuffer.slice(this.cursorPos);
			this.cursorPos++;
			this.drawInputLines();
		}
	}

	// ── Submitting input ───────────────────────────────────────────

	private async submit(): Promise<void> {
		const trimmed = this.inputBuffer.trim();
		this.inputBuffer = "";
		this.cursorPos = 0;

		if (!trimmed) {
			this.drawInputLines();
			return;
		}

		// Built-in commands
		if (trimmed === "/exit" || trimmed === "/quit") {
			this.shutdown();
			return;
		}

		if (trimmed === "/clear") {
			this.history = [];
			if (this.conversationId) {
				this.store.delete(this.conversationId);
			}
			const conv = this.store.create();
			this.conversationId = conv.id;
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
					`  ${color("/clear", C.green)} — Clear this conversation`,
					`  ${color("/list", C.green)} — List all conversations`,
					`  ${color("/delete <id>", C.green)} — Delete a conversation`,
					`  ${color("/help", C.green)} — Show this help`,
					``,
					color("Editing:", C.bold),
					`  ${color("Enter", C.green)} — Submit message`,
					`  ${color("Alt+Enter", C.green)} — New line in message`,
					`  ${color("↑/↓", C.green)} — Jump between lines`,
				].join("\n"),
			);
			return;
		}

		if (trimmed.startsWith("/list")) {
			const convs = this.store.list();
			if (convs.length === 0) {
				this.writeContent(color("No conversations.", C.dim));
			} else {
				const lines = convs.map((c) => {
					const active = c.id === this.conversationId ? " ← current" : "";
					const title = c.title || c.id.substring(0, 12);
					const msgs = c.messages.length > 0 ? ` (${Math.ceil(c.messages.length / 2)} msgs)` : "";
					return `  ${color(c.id, C.cyan)}  ${title}${color(msgs, C.dim)}${color(active, C.green)}`;
				});
				this.writeContent(
					color(`Conversations (${convs.length}):`, C.bold) +
						"\n" +
						lines.join("\n"),
				);
			}
			return;
		}

		if (trimmed.startsWith("/delete ")) {
			const targetId = trimmed.slice(8).trim();
			if (!targetId) {
				this.writeContent(color("Usage: /delete <conversation-id>", C.yellow));
				return;
			}
			const exists = this.store.get(targetId);
			if (!exists) {
				this.writeContent(color(`Conversation "${targetId}" not found.`, C.red));
				return;
			}
			this.store.delete(targetId);
			// If we deleted our current conversation, create a new one
			if (this.conversationId === targetId) {
				const conv = this.store.create();
				this.conversationId = conv.id;
				this.history = [];
				clearScreen();
				this.setScrollRegion();
				this.drawBottomBar();
				this.writeContent(color(`— Deleted "${targetId}" and started fresh —`, C.dim));
			} else {
				this.writeContent(color(`Deleted "${targetId}".`, C.dim));
			}
			return;
		}

		// User message
		this.history.push({ role: "user", content: trimmed });
		// Persist to store
		if (this.conversationId) {
			this.store.addMessage(this.conversationId, {
				role: "user",
				content: trimmed,
			});
		}
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
				// Persist to store
				if (this.conversationId) {
					this.store.addMessage(this.conversationId, {
						role: "assistant",
						content: result.content,
					});
				}
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
							find: (id: string) => providers.find((p) => p.id === id) || null,
							getActiveProvider: (providerId?: string) => {
								if (providerId) {
									return providers.find((p) => p.id === providerId) ?? null;
								}
								return activeProvider;
							},
						},
						{
							completionHandler: async (_, messages) => {
								const { AgentLoop } = await import("../../agent/index.js");
								const { getRegistry, registerDefaultProviders } = await import(
									"../../providers/index.js"
								);

								registerDefaultProviders();
								const registry = getRegistry();
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
								const provider = registry.create(activeProvider.type as any, {
									provider: activeProvider.type,
									apiKey: activeProvider.apiKey,
									baseUrl: activeProvider.baseUrl,
									model: activeProvider.defaultModel || opts.model,
									maxTokens: activeProvider.maxTokens,
									temperature: activeProvider.temperature,
									timeout: activeProvider.timeoutMs,
								});

								const agent = new AgentLoop({
									systemPrompt,
									maxToolCalls: 20,
									model: activeProvider.defaultModel || opts.model,
								});
								await agent.start();
								try {
									const result = await agent.processMessage(
										messages[messages.length - 1] as {
											role: "user" | "assistant" | "system";
											content: string;
											metadata?: Record<string, unknown>;
										},
										provider,
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
						const store = new ConversationStore(wsDir);
						const tui = new ChatTUI(chat, systemPrompt, store, opts.model);
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
