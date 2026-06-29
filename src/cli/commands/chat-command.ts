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
import type { ProviderType } from "../../providers/types.js";
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

const C = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	rev: "\x1b[7m",
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
	const isUser = msg.role === "user";
	const isAssistant = msg.role === "assistant";

	// Role label: reverse video with role color
	const roleLabel = isUser
		? color(" You ", C.rev + C.green)
		: isAssistant
			? color(" AI ", C.rev + C.cyan)
			: color(" System ", C.rev + C.yellow);

	// Body: code blocks dimmed, otherwise plain text
	const lines = msg.content.split("\n");
	const formatted = lines
		.map((line) => {
			if (line.startsWith("```")) return color(line, C.dim);
			if (line.startsWith("|")) return color(line, C.dim);
			return line;
		})
		.join("\n");

	return `${roleLabel}\n${formatted}`;
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
	private providerName: string;
	private modelName: string;
	private store: ConversationStore;
	private resolvePromise!: () => void;

	constructor(
		chat: ChatService,
		systemPrompt: string,
		providerName: string,
		modelName: string,
		store: ConversationStore,
	) {
		this.chat = chat;
		this.systemPrompt = systemPrompt;
		this.providerName = providerName;
		this.modelName = modelName;
		this.store = store;
		this.registerCommands();
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

		this.statusText = `${this.providerName} • Ready`;
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
		}

		// Welcome message
		this.writeRaw(
			`${color("🚀 Synthtek Chat", C.magenta)} ${color(`(${this.providerName} / ${this.modelName || "default"})`, C.dim)}`,
		);
		if (this.history.length === 0) {
			this.writeRaw(
				color(
					"Type /help for commands. Enter = submit, Alt+Enter = newline.",
					C.dim,
				),
			);
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

		// Row 1 of bar: thin separator
		cursorMove(barTop, 1);
		clearLine();
		process.stdout.write(`\x1b[2m${"─".repeat(w)}\x1b[0m`);

		// Row 2 of bar: primary status (grey)
		cursorMove(barTop + 1, 1);
		clearLine();
		const spinner = this.isWaiting ? "⏳ " : "  ";
		process.stdout.write(color(`${spinner}${this.statusText}`, C.grey));

		// Row 3 of bar: secondary info — provider • model • msgs • convs
		cursorMove(barTop + 2, 1);
		clearLine();
		const providerInfo = this.providerName
			? `Provider: ${this.providerName}`
			: "";
		const modelInfo = this.modelName ? `Model: ${this.modelName}` : "";
		const msgCount =
			this.history.length > 0
				? `Msgs: ${Math.ceil(this.history.length / 2)}`
				: "";
		const convCount = this.store.list().length;
		const parts = [
			providerInfo,
			modelInfo,
			msgCount,
			`${convCount} conversations`,
		].filter(Boolean);
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

		// Update secondary info
		cursorMove(barTop + 2, 1);
		clearLine();
		const providerInfo = this.providerName
			? `Provider: ${this.providerName}`
			: "";
		const modelInfo = this.modelName ? `Model: ${this.modelName}` : "";
		const msgCount =
			this.history.length > 0
				? `Msgs: ${Math.ceil(this.history.length / 2)}`
				: "";
		const convCount = this.store.list().length;
		const parts = [
			providerInfo,
			modelInfo,
			msgCount,
			`${convCount} conversations`,
		].filter(Boolean);
		process.stdout.write(color(` ${parts.join("  •  ")}`, C.dim));

		this.drawInputLines();
	}

	// ── Content writing ────────────────────────────────────────────

	/** Write a line into the scrollable content area. */
	private writeRaw(text: string): void {
		const h = tHeight();
		const scrollBottom = Math.max(1, h - STATUS_ROWS);
		// Write newline first to scroll the region, then the text fills
		// the new blank line at the bottom — avoids trailing blank lines.
		cursorMove(scrollBottom, 1);
		process.stdout.write(`\n${text}`);
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
		if (
			(key.meta || key.ctrl) &&
			(key.name === "return" || key.name === "enter")
		) {
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

	private commands = new Map<
		string,
		{ desc: string; run: (args: string) => void | Promise<void> }
	>();

	private registerCommands(): void {
		const cmds: Array<{
			name: string;
			aliases?: string[];
			desc: string;
			run: (args: string) => void | Promise<void>;
		}> = [
			{
				name: "/exit",
				aliases: ["/quit"],
				desc: "Exit the chat",
				run: () => this.shutdown(),
			},
			{
				name: "/clear",
				desc: "Clear this conversation",
				run: () => {
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
				},
			},
			{
				name: "/help",
				desc: "Show this help",
				run: () => {
					const lines = Array.from(this.commands.entries())
						.filter(([k]) => !k.includes(":")) // skip alias keys
						.map(
							([k, v]) =>
								`  ${color(k, C.green)}${v.desc ? ` — ${v.desc}` : ""}`,
						);
					this.writeContent(
						[
							color("Commands:", C.bold),
							...lines,
							``,
							color("Editing:", C.bold),
							`  ${color("Enter", C.green)} — Submit message`,
							`  ${color("Alt+Enter", C.green)} — New line in message`,
							`  ${color("↑/↓", C.green)} — Jump between lines`,
						].join("\n"),
					);
				},
			},
			{
				name: "/list",
				desc: "List all conversations",
				run: () => {
					const convs = this.store.list();
					if (convs.length === 0) {
						this.writeContent(color("No conversations.", C.dim));
						return;
					}
					const lines = convs.map((c) => {
						const active =
							c.id === this.conversationId ? color(" ← current", C.green) : "";
						const title = c.title || c.id.substring(0, 12);
						const msgs =
							c.messages.length > 0
								? ` (${Math.ceil(c.messages.length / 2)} msgs)`
								: "";
						return `  ${color(c.id, C.cyan)}  ${title}${color(msgs, C.dim)}${active}`;
					});
					this.writeContent(
						color(`Conversations (${convs.length}):`, C.bold) +
							"\n" +
							lines.join("\n"),
					);
				},
			},
			{
				name: "/delete",
				desc: "/delete <id> — Delete a conversation",
				run: (args) => {
					const targetId = args.trim();
					if (!targetId) {
						this.writeContent(
							color("Usage: /delete <conversation-id>", C.yellow),
						);
						return;
					}
					if (!this.store.get(targetId)) {
						this.writeContent(
							color(`Conversation "${targetId}" not found.`, C.red),
						);
						return;
					}
					this.store.delete(targetId);
					if (this.conversationId === targetId) {
						const conv = this.store.create();
						this.conversationId = conv.id;
						this.history = [];
						clearScreen();
						this.setScrollRegion();
						this.drawBottomBar();
						this.writeContent(
							color(`— Deleted "${targetId}" and started fresh —`, C.dim),
						);
					} else {
						this.writeContent(color(`Deleted "${targetId}".`, C.dim));
					}
				},
			},
		];

		for (const cmd of cmds) {
			this.commands.set(cmd.name, cmd);
			for (const alias of cmd.aliases ?? []) {
				this.commands.set(alias, cmd);
			}
		}
	}

	private async submit(): Promise<void> {
		const trimmed = this.inputBuffer.trim();
		this.inputBuffer = "";
		this.cursorPos = 0;

		if (!trimmed) {
			this.drawInputLines();
			return;
		}

		// Slash-command dispatch
		if (trimmed.startsWith("/")) {
			const spaceIdx = trimmed.indexOf(" ");
			const cmdName = spaceIdx >= 0 ? trimmed.slice(0, spaceIdx) : trimmed;
			const args = spaceIdx >= 0 ? trimmed.slice(spaceIdx + 1) : "";
			const handler = this.commands.get(cmdName);
			if (handler) {
				await handler.run(args);
				return;
			}
		}

		// Regular message: persist user input
		this.history.push({ role: "user", content: trimmed });
		this.persistMessage("user", trimmed);
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
				this.statusText = this.detectStatusFromError(result.error);
			} else {
				const assistantMsg: ChatMessage = {
					role: "assistant",
					content: result.content,
				};
				this.history.push(assistantMsg);
				this.persistMessage("assistant", result.content);
				this.writeContent(formatMessage(assistantMsg));
				this.writeContent("");
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Unknown error";
			this.writeContent(color(`✖ Error: ${msg}`, C.red));
			this.statusText = this.detectStatusFromError(msg);
		}

		this.isWaiting = false;
		this.statusText = "Ready";
		this.updateStatusOnly();
	}

	private persistMessage(role: "user" | "assistant", content: string): void {
		if (!this.conversationId) return;
		this.store.addMessage(this.conversationId, { role, content });
	}

	/** Map error messages to a concise status label shown in the bar. */
	private detectStatusFromError(error: string): string {
		const lower = error.toLowerCase();
		if (
			lower.includes("429") ||
			lower.includes("rate limit") ||
			lower.includes("too many requests")
		)
			return "⚠ Throttled";
		if (
			lower.includes("timeout") ||
			lower.includes("timed out") ||
			lower.includes("deadline")
		)
			return "⏱ Timeout";
		if (
			lower.includes("quota") ||
			lower.includes("insufficient") ||
			lower.includes("billing")
		)
			return "⚠ Quota exceeded";
		if (
			lower.includes("auth") ||
			lower.includes("401") ||
			lower.includes("403") ||
			lower.includes("key")
		)
			return "⚠ Auth error";
		if (
			lower.includes("context") ||
			lower.includes("token limit") ||
			lower.includes("max_tokens")
		)
			return "⚠ Context full";
		if (
			lower.includes("unavailable") ||
			lower.includes("overloaded") ||
			lower.includes("503")
		)
			return "⚠ Service down";
		return "✖ Error";
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
								const { AgentSession } = await import("../../agent/session.js");
								const { getRegistry, registerDefaultProviders } = await import(
									"../../providers/index.js"
								);

								registerDefaultProviders();
								const registry = getRegistry();
								const provider = registry.create(
									activeProvider.type as ProviderType,
									{
										provider: activeProvider.type,
										apiKey: activeProvider.apiKey,
										baseUrl: activeProvider.baseUrl,
										model: activeProvider.defaultModel || opts.model,
										maxTokens: activeProvider.maxTokens,
										temperature: activeProvider.temperature,
										timeout: activeProvider.timeoutMs,
									},
								);

								const agent = new AgentSession(provider, {
									systemPrompt,
									maxToolCalls: 20,
									autoPersist: false,
								});

								// Provide full message history (AgentSession uses all but last as history)
								const result = await agent.processMessage(
									messages[messages.length - 1]?.content ?? "",
									undefined,
									messages.slice(0, -1) as Array<{
										role: string;
										content: string;
									}>,
								);
								return { content: result.response };
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
						const tui = new ChatTUI(
							chat,
							systemPrompt,
							activeProvider.type,
							activeProvider.defaultModel || opts.model || activeProvider.type,
							store,
						);
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
