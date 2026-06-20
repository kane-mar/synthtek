/**
 * Chat Component Tests – Session Selection UI
 */

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ChatComponent } from "../../src/webui/frontend/chat.js";
import type { SessionInfo } from "../../src/webui/frontend/types.js";

describe("ChatComponent Session Selection", () => {
	let chat: ChatComponent;

	beforeEach(() => {
		chat = new ChatComponent("session_1");
	});

	describe("setSessions", () => {
		it("should accept a list of sessions", () => {
			const sessions: SessionInfo[] = [
				{
					id: "s1",
					userId: "u1",
					createdAt: 1,
					lastActivity: 1,
					messageCount: 5,
				},
				{
					id: "s2",
					userId: "u1",
					createdAt: 2,
					lastActivity: 2,
					messageCount: 3,
				},
			];
			chat.setSessions(sessions);
			assert.equal(chat.availableSessions.length, 2);
		});

		it("should not change current sessionId when setting sessions", () => {
			const sessions: SessionInfo[] = [
				{
					id: "s1",
					userId: "u1",
					createdAt: 1,
					lastActivity: 1,
					messageCount: 5,
				},
			];
			chat.setSessions(sessions);
			assert.equal(chat.sessionId, "session_1");
		});
	});

	describe("selectSession", () => {
		it("should switch to a valid session", () => {
			const sessions: SessionInfo[] = [
				{
					id: "s1",
					userId: "u1",
					createdAt: 1,
					lastActivity: 1,
					messageCount: 5,
				},
				{
					id: "s2",
					userId: "u1",
					createdAt: 2,
					lastActivity: 2,
					messageCount: 3,
				},
			];
			chat.setSessions(sessions);
			chat.selectSession("s2");
			assert.equal(chat.sessionId, "s2");
		});

		it("should not switch to an invalid session", () => {
			const sessions: SessionInfo[] = [
				{
					id: "s1",
					userId: "u1",
					createdAt: 1,
					lastActivity: 1,
					messageCount: 5,
				},
			];
			chat.setSessions(sessions);
			chat.selectSession("invalid");
			assert.equal(chat.sessionId, "session_1");
		});

		it("should clear messages when switching sessions", () => {
			const sessions: SessionInfo[] = [
				{
					id: "s1",
					userId: "u1",
					createdAt: 1,
					lastActivity: 1,
					messageCount: 5,
				},
				{
					id: "s2",
					userId: "u1",
					createdAt: 2,
					lastActivity: 2,
					messageCount: 3,
				},
			];
			chat.setSessions(sessions);
			chat.addMessage("user", "hello");
			assert.equal(chat.getMessageCount(), 1);

			chat.selectSession("s2");
			assert.equal(chat.getMessageCount(), 0);
		});
	});

	describe("renderSessionSelector", () => {
		it("should render a dropdown with available sessions", () => {
			const sessions: SessionInfo[] = [
				{
					id: "s1",
					userId: "u1",
					createdAt: 1,
					lastActivity: 1,
					messageCount: 5,
				},
				{
					id: "s2",
					userId: "u1",
					createdAt: 2,
					lastActivity: 2,
					messageCount: 3,
				},
			];
			chat.setSessions(sessions);
			const html = chat.renderSessionSelector();
			assert.ok(html.includes("<select"), "Should contain a select element");
			assert.ok(html.includes("s1"), "Should contain session s1");
			assert.ok(html.includes("s2"), "Should contain session s2");
		});

		it("should mark the current session as selected", () => {
			const sessions: SessionInfo[] = [
				{
					id: "s1",
					userId: "u1",
					createdAt: 1,
					lastActivity: 1,
					messageCount: 5,
				},
				{
					id: "s2",
					userId: "u1",
					createdAt: 2,
					lastActivity: 2,
					messageCount: 3,
				},
			];
			chat.setSessions(sessions);
			chat.selectSession("s2");
			const html = chat.renderSessionSelector();
			assert.ok(
				html.includes('value="s2"'),
				"Should have s2 as selected value",
			);
		});

		it("should render empty state when no sessions available", () => {
			const html = chat.renderSessionSelector();
			assert.ok(html.includes("No sessions"), "Should show empty state");
		});
	});

	describe("render with session selector", () => {
		it("should include session selector in full render", () => {
			const sessions: SessionInfo[] = [
				{
					id: "s1",
					userId: "u1",
					createdAt: 1,
					lastActivity: 1,
					messageCount: 5,
				},
			];
			chat.setSessions(sessions);
			const html = chat.render();
			assert.ok(
				html.includes("session-selector"),
				"Should include session selector",
			);
		});
	});
});
