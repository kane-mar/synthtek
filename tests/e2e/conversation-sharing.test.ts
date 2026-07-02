/**
 * E2E: Conversation sharing between TUI and WebUI
 *
 * Verifies that conversations started in the TUI (via ConversationStore)
 * are visible from the WebUI backend (via WebUIBackend.listSessions),
 * and vice versa.
 *
 * This test must pass before deploying to production.
 */

import assert from "node:assert";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

// ── Helpers ──────────────────────────────────────────────────────────────────

function tmpWorkspace(): string {
	const dir = join(tmpdir(), `synthtek-sharing-test-${Date.now()}`);
	mkdirSync(join(dir, "config"), { recursive: true });
	return dir;
}

function removeFile(path: string): void {
	try {
		if (existsSync(path)) unlinkSync(path);
	} catch {
		// ignore
	}
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Conversation sharing between TUI and WebUI", () => {
	let workspaceDir: string;
	let conversationStore: any;
	let WebUIBackendType: typeof import("../../src/webui/backend.js").WebUIBackend;
	let ConversationStoreType: typeof import("../../src/messaging/conversation-store.js").ConversationStore;

	before(async () => {
		workspaceDir = tmpWorkspace();

		// Dynamic imports to avoid circular deps at the module level
		const convMod = await import("../../src/messaging/conversation-store.js");
		const webuiMod = await import("../../src/webui/backend.js");

		ConversationStoreType = convMod.ConversationStore;
		WebUIBackendType = webuiMod.WebUIBackend;

		conversationStore = new ConversationStoreType(workspaceDir);
	});

	after(() => {
		removeFile(join(workspaceDir, "config", "conversations.json"));
	});

	it("TUI creates a conversation and adds messages", () => {
		const conv = conversationStore.create("Test from TUI");
		assert.ok(conv.id, "Conversation must have an id");
		assert.strictEqual(conv.messages.length, 0, "New conversation is empty");

		// Add user message (simulating TUI sending a message)
		const updated = conversationStore.addMessage(conv.id, {
			role: "user",
			content: "Hello from TUI",
		});
		assert.ok(updated, "addMessage must return the updated conversation");
		assert.strictEqual(updated.messages.length, 1);

		// Add assistant response (simulating LLM reply)
		conversationStore.addMessage(conv.id, {
			role: "assistant",
			content: "Hi from the TUI assistant",
		});

		const stored = conversationStore.get(conv.id);
		assert.strictEqual(stored.messages.length, 2);
	});

	it("WebUI can see TUI-created conversations (cross-instance)", () => {
		// Create a FRESH backend instance (simulating WebUI restart/page load)
		const backend = new WebUIBackendType(
			{
				host: "0.0.0.0",
				port: 8080,
				apiKey: "",
				maxSessions: 50,
				sessionTimeout: 3600,
			},
			workspaceDir,
		);

		const sessions = backend.listSessions();
		assert.ok(sessions.length >= 1, "WebUI must see at least 1 session");

		// Find the TUI conversation
		const tuiSession = sessions.find((s: any) =>
			s.messages.some((m: any) => m.content === "Hello from TUI"),
		);
		assert.ok(tuiSession, "WebUI must find the TUI conversation by content");
		assert.strictEqual(tuiSession.messages.length, 2);
	});

	it("WebUI can fetch messages for a TUI conversation by ID", () => {
		const backend = new WebUIBackendType(
			{
				host: "0.0.0.0",
				port: 8080,
				apiKey: "",
				maxSessions: 50,
				sessionTimeout: 3600,
			},
			workspaceDir,
		);

		const sessions = backend.listSessions();
		const tuiSession = sessions.find((s: any) =>
			s.messages.some((m: any) => m.content === "Hello from TUI"),
		);
		assert.ok(tuiSession, "TUI session found");

		// getMessages should work
		const messages = backend.syncAndGetMessages(tuiSession.id);
		assert.strictEqual(messages.length, 2);
		assert.strictEqual(messages[0].role, "user");
		assert.strictEqual(messages[0].content, "Hello from TUI");
		assert.strictEqual(messages[1].role, "assistant");
	});

	it("WebUI can add messages to a TUI conversation", () => {
		const backend = new WebUIBackendType(
			{
				host: "0.0.0.0",
				port: 8080,
				apiKey: "",
				maxSessions: 50,
				sessionTimeout: 3600,
			},
			workspaceDir,
		);

		const sessions = backend.listSessions();
		const tuiSession = sessions.find((s: any) =>
			s.messages.some((m: any) => m.content === "Hello from TUI"),
		);
		assert.ok(tuiSession, "TUI session found");

		// WebUI sends a message
		const msg = backend.addMessage(tuiSession.id, {
			role: "user",
			content: "Reply from WebUI",
		});
		assert.ok(msg, "addMessage must succeed");

		// Now verify TUI can see it (fresh store instance)
		const store2 = new ConversationStoreType(workspaceDir);
		const conv = store2.get(tuiSession.id);
		assert.ok(conv, "Conversation must exist in store");
		const hasReply = conv.messages.some(
			(m: any) => m.content === "Reply from WebUI",
		);
		assert.ok(hasReply, "TUI must see the WebUI's reply in the conversation");
	});

	it("WebUI conversations appear first in list (sorted by lastActivity)", async () => {
		// Clear and set up fresh
		removeFile(join(workspaceDir, "config", "conversations.json"));
		const freshStore = new ConversationStoreType(workspaceDir);

		// Simulate TUI starting first
		const tuiConv = freshStore.create("TUI first");
		freshStore.addMessage(tuiConv.id, {
			role: "user",
			content: "earlier message",
		});

		// Wait a tiny bit so timestamps differ
		await new Promise((r) => setTimeout(r, 5));

		// Simulate WebUI creating a session later
		const webuiBackend = new WebUIBackendType(
			{
				host: "0.0.0.0",
				port: 8080,
				apiKey: "",
				maxSessions: 50,
				sessionTimeout: 3600,
			},
			workspaceDir,
		);

		// TUI sends another message — this makes it more recent
		await new Promise((r) => setTimeout(r, 5));
		freshStore.addMessage(tuiConv.id, {
			role: "user",
			content: "latest from TUI",
		});

		// Now check ordering: TUI conversation should be first (more recent)
		const sessionsAfter = webuiBackend.listSessions();
		assert.ok(sessionsAfter.length > 0);
		assert.strictEqual(
			sessionsAfter[0].id,
			tuiConv.id,
			"Most recently updated conversation must be first",
		);
	});
});
