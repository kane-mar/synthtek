/**
 * ConversationStore — persistent, shared conversation storage.
 *
 * Both the WebUI Backend and CLI TUI read/write from the same JSON
 * file, so you can start a conversation in one interface and pick it
 * up in the other.
 *
 * Format: /data/conversations.json  (or {workspace}/conversations.json)
 *   { conversations: Conversation[] }
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ConversationMessage {
	role: "user" | "assistant" | "system";
	content: string;
	timestamp: number;
}

export interface Conversation {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	messages: ConversationMessage[];
}

interface StoreData {
	conversations: Conversation[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
	return `conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── ConversationStore ────────────────────────────────────────────────────────

export class ConversationStore {
	private filePath: string;

	constructor(workspaceDir: string) {
		const dir = join(workspaceDir, "config");
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		this.filePath = join(dir, "conversations.json");
	}

	// ── Internal I/O ──────────────────────────────────────────────────

	private read(): StoreData {
		if (!existsSync(this.filePath)) {
			return { conversations: [] };
		}
		try {
			const raw = readFileSync(this.filePath, "utf-8");
			return JSON.parse(raw) as StoreData;
		} catch {
			return { conversations: [] };
		}
	}

	private write(data: StoreData): void {
		writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf-8");
	}

	private invalidate(): void {
		// No-op: reads go directly to disk
	}

	// ── Public API ────────────────────────────────────────────────────

	/** Return all conversations, newest first. */
	list(): Conversation[] {
		const data = this.read();
		return [...data.conversations].sort(
			(a, b) => b.updatedAt - a.updatedAt,
		);
	}

	/** Get a single conversation by id. */
	get(id: string): Conversation | null {
		const data = this.read();
		return data.conversations.find((c) => c.id === id) ?? null;
	}

	/** Create a new empty conversation. */
	create(title?: string): Conversation {
		const data = this.read();
		const now = Date.now();
		const conv: Conversation = {
			id: generateId(),
			title: title || "New Conversation",
			createdAt: now,
			updatedAt: now,
			messages: [],
		};
		data.conversations.push(conv);
		this.write(data);
		return conv;
	}

	/** Save an entire conversation object (replaces by id). */
	save(conv: Conversation): void {
		const data = this.read();
		const idx = data.conversations.findIndex((c) => c.id === conv.id);
		conv.updatedAt = Date.now();
		if (idx >= 0) {
			data.conversations[idx] = conv;
		} else {
			data.conversations.push(conv);
		}
		this.write(data);
	}

	/** Add a message to a conversation. Returns updated conversation or null. */
	addMessage(
		conversationId: string,
		msg: Omit<ConversationMessage, "timestamp">,
	): Conversation | null {
		const data = this.read();
		const conv = data.conversations.find((c) => c.id === conversationId);
		if (!conv) return null;
		conv.messages.push({ ...msg, timestamp: Date.now() });
		conv.updatedAt = Date.now();
		this.write(data);
		return conv;
	}

	/** Delete a conversation by id. */
	delete(id: string): boolean {
		const data = this.read();
		const idx = data.conversations.findIndex((c) => c.id === id);
		if (idx < 0) return false;
		data.conversations.splice(idx, 1);
		this.write(data);
		return true;
	}

	/** Reload from disk (call if another process may have changed the file). */
	reload(): void {
		this.invalidate();
	}
}
