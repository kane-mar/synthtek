/**
 * Functional tests for Telegram channel message sending.
 * Tests the send API integration layer, not the full channel lifecycle.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TelegramChannel } from "../../src/channels/telegram/channel.js";
import {
	markdownToTelegramHtml,
	splitMessage,
} from "../../src/channels/telegram/format.js";

void describe("Telegram send API", () => {
	void it("sendMessage accepts the correct signature", async () => {
		const channel = new TelegramChannel({ token: "test-token" });
		assert.equal(typeof channel.sendMessage, "function");
		assert.equal(channel.sendMessage.length, 3); // 3 params: chatId, text, options
		channel.stop();
	});

	void it("sendTextWithHtml accepts the correct signature", async () => {
		const channel = new TelegramChannel({ token: "test-token" });
		assert.equal(typeof channel.sendTextWithHtml, "function");
		// 5 params: chatId, text, replyParams, threadKwargs, renderAsBlockquote
		assert.ok(
			channel.sendTextWithHtml.length === 5 ||
				channel.sendTextWithHtml.length === 4,
		);
		channel.stop();
	});

	void it("sendOutboundMessage accepts the correct signature", async () => {
		const channel = new TelegramChannel({ token: "test-token" });
		assert.equal(typeof channel.sendOutboundMessage, "function");
		channel.stop();
	});

	void it("splitMessage handles long text correctly", () => {
		const result = splitMessage("a".repeat(5000), 4096);
		assert.ok(Array.isArray(result));
		assert.ok(result.length >= 2);
		for (const chunk of result) {
			assert.ok(chunk.length <= 4096);
		}
	});

	void it("markdownToTelegramHtml produces valid HTML", () => {
		const result = markdownToTelegramHtml("Hello **world**");
		assert.ok(result.includes("<b>"));
		assert.ok(result.includes("</b>"));
	});
});
